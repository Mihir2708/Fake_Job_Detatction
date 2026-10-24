import { sendSuccess } from '../utils/apiResponse.js';
import { getDbStatus } from '../config/db.js';
import { config } from '../config/env.js';

/**
 * Controller to handle GET /api/health
 * Returns server health, uptime, environment, and database status
 */
export const getHealth = (req, res) => {
  const healthData = {
    server: 'Fake Job Detection API',
    status: 'healthy',
    uptimeSeconds: Math.floor(process.uptime()),
    environment: config.nodeEnv,
    database: getDbStatus(),
    geminiConfigured: Boolean(config.geminiApiKey),
    timestamp: new Date().toISOString(),
  };

  return sendSuccess(res, {
    statusCode: 200,
    message: 'Server is running smoothly',
    data: healthData,
  });
};
