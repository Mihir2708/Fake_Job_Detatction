import mongoose from 'mongoose';

const JobAnalysisSchema = new mongoose.Schema(
  {
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
      required: [true, 'Job description is required'],
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
  },
  {
    timestamps: true,
  }
);

JobAnalysisSchema.index({ createdAt: -1 });

export const JobAnalysis = mongoose.model('JobAnalysis', JobAnalysisSchema);
