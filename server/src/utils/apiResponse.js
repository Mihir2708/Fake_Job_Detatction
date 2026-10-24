/**
 * Utility functions for consistent API JSON responses
 */

export const sendSuccess = (res, { statusCode = 200, message = 'Success', data = null, meta = null, pagination = null }) => {
  const response = {
    success: true,
    message,
    ...(data !== null && { data }),
    ...(pagination !== null && { pagination }),
    ...(meta !== null && { meta }),
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(response);
};

export const sendError = (res, { statusCode = 500, message = 'Internal Server Error', error = null, errors = null }) => {
  const response = {
    success: false,
    message,
    ...(error !== null && { error }),
    ...(errors !== null && { errors }),
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(response);
};
