import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config/env.js';
import { connectDB } from './config/db.js';
import { logger } from './utils/logger.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';

// Validate environment variables on startup
validateConfig();

const app = express();

// Enable CORS for local frontend, Vercel deployments, and configured client URL
const allowedOrigins = [
  config.clientUrl,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      // or from configured client URL, localhost, or any *.vercel.app deployment
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        (typeof origin === 'string' && origin.endsWith('.vercel.app')) ||
        config.nodeEnv !== 'production'
      ) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// JSON and URL-encoded request body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root welcome route
app.get('/', (req, res) => {
  res.json({
    name: 'Fake Job Detection API',
    version: '1.0.0',
    documentation: '/api/health',
    status: 'online',
  });
});

// API Routes (mounted on /api and root to support both direct Express and Vercel serverless)
app.use('/api', apiRoutes);
app.use('/', apiRoutes);

// 404 Route Not Found Middleware
app.use(notFoundHandler);

// Centralized Error Handling Middleware
app.use(errorHandler);

// Start server function (for local development and persistent hosting)
const startServer = async () => {
  // Connect to MongoDB
  await connectDB();

  const server = app.listen(config.port, () => {
    logger.info(`Server running in [${config.nodeEnv}] mode on http://localhost:${config.port}`);
    logger.info(`Health check available at: http://localhost:${config.port}/api/health`);
  });

  // Graceful shutdown handling
  const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

// Only bind to local port when not running in Vercel serverless functions
if (!process.env.VERCEL) {
  startServer();
}

export default app;
