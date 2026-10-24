import mongoose from 'mongoose';

/**
 * Extended JobAnalysis schema.
 *
 * Backward-compatible with v1 records: all new fields have defaults
 * so existing documents are not broken.
 *
 * New fields added:
 *  - jobUrl, salary, currency, recruiterName, recruiterEmail, recruiterPhone,
 *    applicationUrl, applicationSource (input fields)
 *  - verificationChecks (structured evidence from multi-layer pipeline)
 *  - riskScore, verdictLabel, evidenceCoverage, scoringBreakdown (scoring engine)
 *  - redFlags, greenFlags (from enhanced Gemini response)
 *  - urlIngestion (safe URL fetch result)
 */
const JobAnalysisSchema = new mongoose.Schema(
  {
    // ── Core Job Details (existing) ────────────────────────────────────────────
    jobTitle: {
      type: String,
      trim: true,
      default: '',
      maxlength: [200, 'Job title cannot exceed 200 characters'],
    },
    companyName: {
      type: String,
      trim: true,
      default: '',
      maxlength: [200, 'Company name cannot exceed 200 characters'],
    },
    jobDescription: {
      type: String,
      default: '',
      maxlength: [15000, 'Job description cannot exceed 15000 characters'],
    },
    requirements: {
      type: String,
      trim: true,
      default: '',
      maxlength: [5000, 'Requirements cannot exceed 5000 characters'],
    },
    location: {
      type: String,
      trim: true,
      default: '',
      maxlength: [200, 'Location cannot exceed 200 characters'],
    },

    // ── New Input Fields ───────────────────────────────────────────────────────
    jobUrl: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2048, 'Job URL cannot exceed 2048 characters'],
    },
    salary: {
      type: String,
      trim: true,
      default: '',
      maxlength: [200, 'Salary cannot exceed 200 characters'],
    },
    currency: {
      type: String,
      trim: true,
      default: '',
      maxlength: [10, 'Currency code cannot exceed 10 characters'],
    },
    recruiterName: {
      type: String,
      trim: true,
      default: '',
      maxlength: [200, 'Recruiter name cannot exceed 200 characters'],
    },
    recruiterEmail: {
      type: String,
      trim: true,
      default: '',
      maxlength: [320, 'Recruiter email cannot exceed 320 characters'],
    },
    recruiterPhone: {
      type: String,
      trim: true,
      default: '',
      maxlength: [30, 'Recruiter phone cannot exceed 30 characters'],
    },
    applicationUrl: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2048, 'Application URL cannot exceed 2048 characters'],
    },
    applicationSource: {
      type: String,
      trim: true,
      default: '',
      maxlength: [200, 'Application source cannot exceed 200 characters'],
    },

    // ── AI Analysis (existing — preserved for backward compatibility) ──────────
    prediction: {
      type: String,
      enum: ['LIKELY_REAL', 'SUSPICIOUS', 'INSUFFICIENT_INFORMATION'],
      required: true,
      default: 'INSUFFICIENT_INFORMATION',
    },
    riskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'],
      required: true,
      default: 'UNKNOWN',
    },
    reasons: {
      type: [String],
      default: [],
    },
    redFlags: {
      type: [String],
      default: [],
    },
    greenFlags: {
      type: [String],
      default: [],
    },
    recommendation: {
      type: String,
      default: '',
    },
    limitations: {
      type: String,
      default: '',
    },
    confidence: {
      type: Number,
      default: null,
    },
    aiModel: {
      type: String,
      default: 'gemini-1.5-flash',
    },

    // ── Evidence-Based Risk Score (new) ────────────────────────────────────────
    riskScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    verdictLabel: {
      type: String,
      enum: ['Lower Risk', 'Caution', 'High Risk', 'Insufficient Information', null],
      default: null,
    },
    evidenceCoverage: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    scoringBreakdown: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // ── Multi-Layer Verification Results (new) ────────────────────────────────
    verificationChecks: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // ── URL Ingestion Result (new) ─────────────────────────────────────────────
    urlIngestion: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

JobAnalysisSchema.index({ createdAt: -1 });
JobAnalysisSchema.index({ riskScore: -1 });
JobAnalysisSchema.index({ prediction: 1 });

export const JobAnalysis = mongoose.model('JobAnalysis', JobAnalysisSchema);
