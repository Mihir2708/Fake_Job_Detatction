/**
 * Clean logger utility for structured server logging
 */
export const logger = {
  info: (message, meta = '') => {
    console.log(`[${new Date().toISOString()}] [INFO] ${message}`, meta ? meta : '');
  },
  warn: (message, meta = '') => {
    console.warn(`[${new Date().toISOString()}] [WARN] ${message}`, meta ? meta : '');
  },
  error: (message, error = '') => {
    console.error(`[${new Date().toISOString()}] [ERROR] ${message}`, error ? error : '');
  },
  debug: (message, meta = '') => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${new Date().toISOString()}] [DEBUG] ${message}`, meta ? meta : '');
    }
  },
};
