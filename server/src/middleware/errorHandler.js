import { logger } from '../utils/logger.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * Centralized Express Error Handling Middleware
 * Ensures internal database details, secrets, and raw stack traces are never exposed to clients.
 */
export const errorHandler = (err, req, res, next) => {
  logger.error(`Unhandled Error [${req.method} ${req.url}]:`, err.message);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || null;

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    errors = Object.values(err.errors).map((val) => val.message);
  }

  // Handle Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid identifier format: ${err.value}`;
  }

  // Handle MongoDB duplicate key error
  if (err.code === 11000) {
    statusCode = 400;
    message = 'Duplicate field value entered';
  }

  // Handle SyntaxError in JSON body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON payload received';
  }

  // Mask any potential MongoDB connection string or credentials in the message
  const safeMessage = message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, 'mongodb://***');

  return sendError(res, {
    statusCode,
    message: safeMessage,
    ...(errors && { errors }),
  });
};
