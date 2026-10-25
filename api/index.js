import app from '../server/src/server.js';
import { connectDB } from '../server/src/config/db.js';

/**
 * Vercel Serverless Function entry point
 * Handles /api/* requests by routing directly into the Express app
 */
export default async function handler(req, res) {
  try {
    await connectDB();
  } catch (err) {
    // Database connection failure does not block the API
    // Controllers will return appropriate 503 if DB queries fail
  }
  return app(req, res);
}
