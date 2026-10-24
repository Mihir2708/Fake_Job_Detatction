import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables with resolution from server/.env, root .env, or process.cwd()
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/fake_job_detection',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || process.env.GEMINI_CHAT_MODEL || 'gemini-3.1-flash-lite',
};

// Validate critical configurations on server startup
export const validateConfig = () => {
  const warnings = [];

  if (!config.geminiApiKey) {
    warnings.push('GEMINI_API_KEY is not set. Requests to /api/analysis/analyze will return HTTP 503 until configured.');
  }

  if (!config.mongodbUri) {
    warnings.push('MONGODB_URI is not set. Database persistence and analysis history will be unavailable.');
  }

  if (warnings.length > 0) {
    console.warn(`\n[CONFIGURATION NOTICE]\n - ${warnings.join('\n - ')}\n`);
  }
};
