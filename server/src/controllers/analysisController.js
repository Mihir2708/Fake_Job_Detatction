/**
 * analysisController.js
 *
 * Orchestrates the multi-layer fake job detection pipeline:
 *
 *  Step 0: Input validation
 *  Step 1: URL ingestion (SSRF-safe fetch if jobUrl provided)
 *  Step 2: Parallel verification checks (independent, with timeouts):
 *           - Company verification (web search + domain/DNS/RDAP)
 *           - Careers/ATS verification (Greenhouse, Lever)
 *           - Recruiter/contact verification (email domain, app URL)
 *           - Scam intelligence (safe browsing, scam search, advance-fee patterns)
 *           - Salary benchmarking
 *  Step 3: Gemini AI analysis (with collected evidence as context)
 *  Step 4: Evidence-based risk scoring
 *  Step 5: MongoDB persistence
 *  Step 6: Structured response
 *
 * Design principles:
 *  - Parallel execution for independent checks
 *  - Per-service timeout wrappers (graceful degradation)
 *  - No service failure blocks the overall response
 *  - Gemini receives actual evidence, not invented sources
 *  - Risk score is computed deterministically, separate from Gemini
 */

import mongoose from 'mongoose';
import { analyzeJobPosting } from '../services/geminiService.js';
import { validateAnalyzeJobInput } from '../utils/validation.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { JobAnalysis } from '../models/JobAnalysis.js';
import { isDbConnected } from '../config/db.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { fetchJobPostingFromUrl } from '../services/urlIngestionService.js';
import { verifyCompany } from '../services/companyVerificationService.js';
import { verifyJobListing } from '../services/careersVerificationService.js';
import { verifyRecruiter } from '../services/recruiterVerificationService.js';
import { runScamIntelligence } from '../services/scamIntelligenceService.js';
import { benchmarkSalary } from '../services/salaryBenchmarkService.js';
import { computeRiskScore } from '../services/riskScoringService.js';

// ── Timeout Wrapper ───────────────────────────────────────────────────────────

/**
 * Wraps a service call with a configurable timeout.
 * Returns a default value if the service times out or throws.
 *
 * @param {Promise} promise
 * @param {number} timeoutMs
 * @param {*} fallback - Value to return on timeout/error
 * @param {string} label - Service label for logging
 * @returns {Promise<*>}
 */
const withTimeout = async (promise, timeoutMs, fallback, label) => {
  let timerId;
  const timeout = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    return result;
  } catch (err) {
    logger.warn(`[Pipeline] ${label} failed:`, err.message);
    return fallback;
  } finally {
    clearTimeout(timerId);
  }
};

// ── Default Fallback Values ───────────────────────────────────────────────────

const makeFallbackCheck = (label) => ({
  overallStatus: 'SOURCE_UNAVAILABLE',
  checkedAt: new Date().toISOString(),
  explanation: `${label} could not be completed (service timed out or encountered an error).`,
});

// ── Controller: POST /api/analysis/analyze ────────────────────────────────────

/**
 * Main analysis controller.
 * Orchestrates the full multi-layer verification and scoring pipeline.
 */
export const analyzeJob = async (req, res, next) => {
  try {
    // ── Step 0: Validate and sanitize input ────────────────────────────────────
    const validation = validateAnalyzeJobInput(req.body);
    if (!validation.isValid) {
      return sendError(res, { statusCode: 400, message: validation.error });
    }

    const data = validation.sanitizedData;
    logger.info(`[Pipeline] Starting analysis: "${data.jobTitle || 'Unknown'}" at "${data.companyName || 'Unknown'}"`);

    // ── Step 1: URL ingestion (if jobUrl provided) ─────────────────────────────
    let urlIngestionResult = null;
    let effectiveJobDescription = data.jobDescription;

    if (data.jobUrl) {
      logger.info(`[Pipeline] Fetching job from URL: ${data.jobUrl}`);
      urlIngestionResult = await withTimeout(
        fetchJobPostingFromUrl(data.jobUrl),
        12000,
        { success: false, status: 'TIMEOUT', originalUrl: data.jobUrl, finalUrl: null, extractedText: null, explanation: 'URL fetch timed out.' },
        'URL Ingestion'
      );

      // If URL fetch succeeded and no manual description provided, use extracted text
      if (urlIngestionResult?.success && urlIngestionResult.extractedText && !effectiveJobDescription) {
        effectiveJobDescription = urlIngestionResult.extractedText;
        logger.info(`[Pipeline] Using extracted text from URL (${urlIngestionResult.bytesRead} bytes read)`);
      }
    }

    // If we still have no job description, return early
    if (!effectiveJobDescription || effectiveJobDescription.trim().length < 30) {
      return sendError(res, {
        statusCode: 422,
        message: 'A valid job description (minimum 30 characters) is required.',
      });
    }

    const jobDataForServices = { ...data, jobDescription: effectiveJobDescription };

    // ── Step 2: Parallel verification checks ──────────────────────────────────
    logger.info('[Pipeline] Running parallel verification checks...');

    const TIMEOUTS = {
      company: 15000,
      careers: 15000,
      scam: 10000,
      salary: 2000,
    };

    const [companyVerification, careersVerification, scamIntelligence, salaryBenchmark] =
      await Promise.all([
        withTimeout(
          verifyCompany(data.companyName),
          TIMEOUTS.company,
          makeFallbackCheck('Company verification'),
          'Company Verification'
        ),
        withTimeout(
          verifyJobListing(data.companyName, data.jobTitle),
          TIMEOUTS.careers,
          makeFallbackCheck('Careers/ATS verification'),
          'Careers Verification'
        ),
        withTimeout(
          runScamIntelligence({
            companyName: data.companyName,
            recruiterEmail: data.recruiterEmail,
            officialDomain: null, // Will be updated after company check if needed
            applicationUrl: data.applicationUrl,
            jobDescription: effectiveJobDescription,
          }),
          TIMEOUTS.scam,
          makeFallbackCheck('Scam intelligence'),
          'Scam Intelligence'
        ),
        Promise.resolve(
          benchmarkSalary({
            jobDescription: effectiveJobDescription,
            requirements: data.requirements,
            salary: data.salary,
            currency: data.currency,
          })
        ),
      ]);

    // Recruiter check (needs official domain from company verification)
    const officialDomain = companyVerification?.identifiedOfficialDomain || null;
    const recruiterVerification = await withTimeout(
      verifyRecruiter({
        recruiterEmail: data.recruiterEmail,
        recruiterName: data.recruiterName,
        recruiterPhone: data.recruiterPhone,
        applicationUrl: data.applicationUrl,
        officialDomain,
      }),
      10000,
      makeFallbackCheck('Recruiter verification'),
      'Recruiter Verification'
    );

    // ── Step 3: Gemini AI analysis with evidence ───────────────────────────────
    logger.info('[Pipeline] Running Gemini AI analysis with collected evidence...');

    const evidenceSummary = {
      company: companyVerification,
      careers: careersVerification,
      recruiter: recruiterVerification,
      scam: scamIntelligence,
      salary: salaryBenchmark,
      urlIngestion: urlIngestionResult,
    };

    let geminiAnalysis;
    try {
      geminiAnalysis = await analyzeJobPosting(jobDataForServices, evidenceSummary);
    } catch (geminiError) {
      // Propagate auth/quota errors, but allow pipeline to continue with scoring on other errors
      if (geminiError.statusCode === 503 || geminiError.statusCode === 429 || geminiError.statusCode === 504) {
        return sendError(res, { statusCode: geminiError.statusCode, message: geminiError.message });
      }
      logger.error('[Pipeline] Gemini analysis failed, continuing with scoring:', geminiError.message);
      geminiAnalysis = {
        prediction: 'INSUFFICIENT_INFORMATION',
        riskLevel: 'UNKNOWN',
        reasons: ['AI analysis could not be completed.'],
        redFlags: [],
        greenFlags: [],
        recommendation: 'Review the verification evidence manually.',
        limitations: 'AI analysis failed. Results are based on structural checks only.',
        confidence: null,
      };
    }

    // ── Step 4: Evidence-based risk scoring ───────────────────────────────────
    logger.info('[Pipeline] Computing evidence-based risk score...');

    const scoringResult = computeRiskScore({
      companyVerification,
      careersVerification,
      recruiterVerification,
      scamIntelligence,
      salaryBenchmark,
      geminiAnalysis,
    });

    logger.info(`[Pipeline] Risk score: ${scoringResult.riskScore} | Verdict: ${scoringResult.verdict} | Coverage: ${scoringResult.evidenceCoverage}%`);

    // ── Step 5: Save to MongoDB ────────────────────────────────────────────────
    let savedRecord = null;
    if (isDbConnected()) {
      try {
        savedRecord = await JobAnalysis.create({
          // Input fields
          jobTitle: data.jobTitle,
          companyName: data.companyName,
          location: data.location,
          requirements: data.requirements,
          jobDescription: effectiveJobDescription,
          jobUrl: data.jobUrl,
          salary: data.salary,
          currency: data.currency,
          recruiterName: data.recruiterName,
          recruiterEmail: data.recruiterEmail,
          recruiterPhone: data.recruiterPhone,
          applicationUrl: data.applicationUrl,
          applicationSource: data.applicationSource,

          // Gemini AI result
          prediction: geminiAnalysis.prediction,
          riskLevel: geminiAnalysis.riskLevel,
          reasons: geminiAnalysis.reasons,
          redFlags: geminiAnalysis.redFlags || [],
          greenFlags: geminiAnalysis.greenFlags || [],
          recommendation: geminiAnalysis.recommendation,
          limitations: geminiAnalysis.limitations,
          confidence: geminiAnalysis.confidence,
          aiModel: config.geminiModel,

          // Scoring
          riskScore: scoringResult.riskScore,
          verdictLabel: scoringResult.verdictLabel,
          evidenceCoverage: scoringResult.evidenceCoverage,
          scoringBreakdown: {
            categoryScores: scoringResult.categoryScores,
            breakdown: scoringResult.breakdown,
            disclaimer: scoringResult.disclaimer,
          },

          // Verification evidence
          verificationChecks: {
            company: companyVerification,
            careers: careersVerification,
            recruiter: recruiterVerification,
            scam: scamIntelligence,
            salary: salaryBenchmark,
          },

          // URL ingestion
          urlIngestion: urlIngestionResult,
        });
      } catch (dbError) {
        logger.error('Failed to save analysis record to MongoDB:', dbError.message);
      }
    } else {
      logger.warn('MongoDB not connected; analysis completed without database persistence.');
    }

    // ── Step 6: Return structured response ────────────────────────────────────
    const responseData = {
      // IDs
      id: savedRecord ? savedRecord._id : null,
      _id: savedRecord ? savedRecord._id : null,

      // Core input
      jobTitle: data.jobTitle,
      companyName: data.companyName,
      location: data.location,
      jobUrl: data.jobUrl,
      createdAt: savedRecord ? savedRecord.createdAt : new Date().toISOString(),

      // AI Analysis
      prediction: geminiAnalysis.prediction,
      riskLevel: geminiAnalysis.riskLevel,
      reasons: geminiAnalysis.reasons,
      redFlags: geminiAnalysis.redFlags || [],
      greenFlags: geminiAnalysis.greenFlags || [],
      recommendation: geminiAnalysis.recommendation,
      limitations: geminiAnalysis.limitations,

      // Evidence-based risk score
      riskScore: scoringResult.riskScore,
      verdict: scoringResult.verdict,
      verdictLabel: scoringResult.verdictLabel,
      evidenceCoverage: scoringResult.evidenceCoverage,
      scoringBreakdown: {
        categoryScores: scoringResult.categoryScores,
        breakdown: scoringResult.breakdown,
        disclaimer: scoringResult.disclaimer,
      },

      // Verification checks (full evidence)
      verificationChecks: {
        company: companyVerification,
        careers: careersVerification,
        recruiter: recruiterVerification,
        scam: scamIntelligence,
        salary: salaryBenchmark,
      },

      // URL ingestion
      urlIngestion: urlIngestionResult,
    };

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Job analysis completed successfully',
      data: responseData,
    });
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, { statusCode: error.statusCode, message: error.message });
    }
    next(error);
  }
};

// ── Controller: GET /api/analysis/history ─────────────────────────────────────

/**
 * Returns paginated analysis history.
 * Backward-compatible: existing records without riskScore will show null.
 */
export const getAnalysisHistory = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return sendError(res, {
        statusCode: 503,
        message: 'Database service is currently unavailable. Please verify MONGODB_URI.',
      });
    }

    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;
    if (limit > 50) limit = 50;

    const skip = (page - 1) * limit;

    const [totalRecords, records] = await Promise.all([
      JobAnalysis.countDocuments(),
      JobAnalysis.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('jobTitle companyName location prediction riskLevel riskScore verdictLabel evidenceCoverage createdAt'),
    ]);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Analysis history retrieved successfully',
      data: records,
      pagination: { totalRecords, currentPage: page, pageSize: limit, totalPages },
    });
  } catch (error) {
    logger.error('Error fetching analysis history:', error.message);
    return sendError(res, {
      statusCode: 500,
      message: 'An error occurred while retrieving analysis history.',
    });
  }
};

// ── Controller: GET /api/analysis/:id ────────────────────────────────────────

/**
 * Returns a single analysis record by MongoDB ObjectId.
 */
export const getAnalysisById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, { statusCode: 400, message: 'Invalid analysis ID format.' });
    }

    if (!isDbConnected()) {
      return sendError(res, {
        statusCode: 503,
        message: 'Database service is currently unavailable. Please verify MONGODB_URI.',
      });
    }

    const record = await JobAnalysis.findById(id);

    if (!record) {
      return sendError(res, { statusCode: 404, message: 'Analysis record not found.' });
    }

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Analysis record retrieved successfully',
      data: record,
    });
  } catch (error) {
    logger.error(`Error retrieving analysis record [${req.params.id}]:`, error.message);
    return sendError(res, {
      statusCode: 500,
      message: 'An error occurred while retrieving the analysis record.',
    });
  }
};
