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

  // Google Gemini AI (required for AI analysis)
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || process.env.GEMINI_CHAT_MODEL || 'gemini-1.5-flash',

  // Tavily Search API (primary web search provider)
  tavilyApiKey: process.env.TAVILY_API_KEY || '',

  // Google Custom Search API (fallback — optional)
  // Get credentials at: https://developers.google.com/custom-search/v1/introduction
  googleSearchApiKey: process.env.GOOGLE_SEARCH_API_KEY || '',
  googleSearchCx: process.env.GOOGLE_SEARCH_CX || '',

  // Google Safe Browsing API (optional — enables phishing/malware URL check)
  // Get key at: https://developers.google.com/safe-browsing/v4/get-started
  googleSafeBrowsingApiKey: process.env.GOOGLE_SAFE_BROWSING_API_KEY || '',
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

  if (!config.tavilyApiKey && (!config.googleSearchApiKey || !config.googleSearchCx)) {
    warnings.push(
      'TAVILY_API_KEY is not set. Company web search and scam report search will be SOURCE_UNAVAILABLE. ' +
      'Set TAVILY_API_KEY in server/.env to enable web search.'
    );
  }

  if (!config.googleSafeBrowsingApiKey) {
    warnings.push(
      'GOOGLE_SAFE_BROWSING_API_KEY is not set. URL malware/phishing check will be SOURCE_UNAVAILABLE. ' +
      'See https://developers.google.com/safe-browsing/v4/get-started to obtain a key.'
    );
  }

  if (warnings.length > 0) {
    console.warn(`\n[CONFIGURATION NOTICE]\n - ${warnings.join('\n - ')}\n`);
  }
};
