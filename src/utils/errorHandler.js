/**
 * Global error handler for the backup system
 */

const logger = require('../audit/logger');

class ErrorHandler {
  /**
   * Handle errors globally
   * @param {Error} error - The error object
   * @param {string} context - Where the error occurred
   * @param {boolean} fatal - Whether this is a fatal error
   */
  static async handle(error, context = 'Unknown', fatal = false) {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    };

    // Log the error
    logger.error('Error occurred', errorInfo);

    // If fatal, exit the process
    if (fatal) {
      console.error(`FATAL ERROR in ${context}:`, error);
      process.exit(1);
    }

    return errorInfo;
  }

  /**
   * Wrap async functions with error handling
   * @param {Function} fn - Async function to wrap
   * @param {string} context - Context for error messages
   */
  static wrap(fn, context) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        await this.handle(error, context);
        throw error;
      }
    };
  }

  /**
   * Retry a function with exponential backoff
   * @param {Function} fn - Function to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} baseDelay - Base delay in milliseconds
   */
  static async retry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Create a user-friendly error message
   * @param {Error} error - The error object
   */
  static getUserMessage(error) {
    const errorMessages = {
      'ENOENT': 'File or directory not found',
      'EACCES': 'Permission denied',
      'ENOSPC': 'No space left on device',
      'ETIMEDOUT': 'Operation timed out',
      'ECONNREFUSED': 'Connection refused'
    };

    return errorMessages[error.code] || error.message || 'An unknown error occurred';
  }
}

module.exports = ErrorHandler;
