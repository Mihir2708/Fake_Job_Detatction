import mongoose from 'mongoose';
import { analyzeJobPosting } from '../services/geminiService.js';
import { validateAnalyzeJobInput } from '../utils/validation.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { JobAnalysis } from '../models/JobAnalysis.js';
import { isDbConnected } from '../config/db.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Controller: Analyze a job posting for scam/fraud risk and persist to MongoDB
 * POST /api/analysis/analyze
 */
export const analyzeJob = async (req, res, next) => {
  try {
    // 1. Validate and sanitize input payload
    const validation = validateAnalyzeJobInput(req.body);
    if (!validation.isValid) {
      return sendError(res, {
        statusCode: 400,
        message: validation.error,
      });
    }

    // 2. Perform AI risk analysis with Google Gemini (throws if key missing or invalid response)
    const analysisResult = await analyzeJobPosting(validation.sanitizedData);

    // 3. Save to MongoDB if connected
    let savedRecord = null;
    if (isDbConnected()) {
      try {
        savedRecord = await JobAnalysis.create({
          jobTitle: validation.sanitizedData.jobTitle,
          companyName: validation.sanitizedData.companyName,
          location: validation.sanitizedData.location,
          requirements: validation.sanitizedData.requirements,
          jobDescription: validation.sanitizedData.jobDescription,
          prediction: analysisResult.prediction,
          riskLevel: analysisResult.riskLevel,
          reasons: analysisResult.reasons,
          recommendation: analysisResult.recommendation,
          limitations: analysisResult.limitations,
          confidence: analysisResult.confidence,
          aiModel: config.geminiModel,
        });
      } catch (dbError) {
        // Log safe message without credentials or stack trace leaks
        logger.error('Failed to save analysis record to MongoDB:', dbError.message);
      }
    } else {
      logger.warn('MongoDB not connected; analysis completed without database persistence.');
    }

    // 4. Return structured analysis result including the newly created record ID
    const responseData = {
      ...analysisResult,
      id: savedRecord ? savedRecord._id : null,
      _id: savedRecord ? savedRecord._id : null,
      jobTitle: validation.sanitizedData.jobTitle,
      companyName: validation.sanitizedData.companyName,
      location: validation.sanitizedData.location,
      createdAt: savedRecord ? savedRecord.createdAt : new Date().toISOString(),
    };

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Job analysis completed successfully',
      data: responseData,
    });
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, {
        statusCode: error.statusCode,
        message: error.message,
      });
    }

    next(error);
  }
};

/**
 * Controller: Get paginated analysis history
 * GET /api/analysis/history?page=1&limit=10
 */
export const getAnalysisHistory = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return sendError(res, {
        statusCode: 503,
        message: 'Database service is currently unavailable. Please verify MONGODB_URI.',
      });
    }

    // Parse and sanitize pagination parameters
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
        .select('jobTitle companyName location prediction riskLevel createdAt'),
    ]);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Analysis history retrieved successfully',
      data: records,
      pagination: {
        totalRecords,
        currentPage: page,
        pageSize: limit,
        totalPages,
      },
    });
  } catch (error) {
    logger.error('Error fetching analysis history:', error.message);
    return sendError(res, {
      statusCode: 500,
      message: 'An error occurred while retrieving analysis history.',
    });
  }
};

/**
 * Controller: Get single analysis record by ID
 * GET /api/analysis/:id
 */
export const getAnalysisById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, {
        statusCode: 400,
        message: 'Invalid analysis ID format.',
      });
    }

    if (!isDbConnected()) {
      return sendError(res, {
        statusCode: 503,
        message: 'Database service is currently unavailable. Please verify MONGODB_URI.',
      });
    }

    const record = await JobAnalysis.findById(id);

    if (!record) {
      return sendError(res, {
        statusCode: 404,
        message: 'Analysis record not found.',
      });
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
