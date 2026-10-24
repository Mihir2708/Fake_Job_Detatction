import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Sanitizes a MongoDB connection URI to mask credentials for safe logging.
 *
 * @param {string} uri
 * @returns {string} Sanitized URI with password replaced
 */
export const sanitizeMongoUri = (uri) => {
  if (!uri || typeof uri !== 'string') return '';
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
};

/**
 * Connects to MongoDB using Mongoose.
 * Avoids leaking raw credentials in case of failure.
 */
export const connectDB = async () => {
  if (!config.mongodbUri) {
    logger.warn('MONGODB_URI is not set. Database persistence will be disabled.');
    return null;
  }

  try {
    const conn = await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });

    const host = conn.connection.host || 'unknown-host';
    const dbName = conn.connection.name || 'default-db';
    logger.info(`MongoDB Connected successfully: ${host}/${dbName}`);
    return conn;
  } catch (error) {
    const sanitizedUri = sanitizeMongoUri(config.mongodbUri);
    // Sanitize any accidental credentials in the error message
    const safeErrorMessage = (error.message || '').replace(/:([^@/]+)@/, ':***@');

    logger.error(`MongoDB connection failed [${sanitizedUri}]:`, safeErrorMessage);
    logger.warn('The application will start, but database operations will return 503 until MongoDB is available.');
    return null;
  }
};

mongoose.connection.on('connected', () => {
  logger.info('MongoDB connection established');
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  const safeMessage = (err.message || '').replace(/:([^@/]+)@/, ':***@');
  logger.error('MongoDB runtime error event:', safeMessage);
});

/**
 * Returns the current MongoDB connection state.
 *
 * @returns {'connected' | 'disconnected' | 'connecting' | 'disconnecting' | 'unknown'}
 */
export const getDbStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] || 'unknown';
};

/**
 * Helper to check if MongoDB is ready to accept queries.
 *
 * @returns {boolean}
 */
export const isDbConnected = () => {
  return mongoose.connection.readyState === 1;
};
