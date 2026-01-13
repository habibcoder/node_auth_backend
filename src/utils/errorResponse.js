/**
 * Error Response Utility
 * 
 * This module provides a standardized way to create error responses.
 * Using a consistent error format makes API consumers' lives easier.
 * 
 * Key concepts for beginners:
 * - Error Classes: Creating custom error types for different scenarios
 * - Consistent API: All errors follow the same format
 * - Status Codes: Using HTTP status codes appropriately
 * - Error Messages: Being helpful but not exposing sensitive information
 */

/**
 * Custom Error class for API errors
 * Extends the built-in Error class to include HTTP status code
 */
class ErrorResponse extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    
    // Capture the stack trace (excluding this constructor)
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Create a standardized error response object
 * 
 * @param {string} message - Human-readable error message
 * @param {number} statusCode - HTTP status code
 * @param {Object} res - Express response object
 * @param {Object} additionalData - Any additional data to include
 * @returns {Object} Formatted error response
 */
const createErrorResponse = (message, statusCode, res, additionalData = {}) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...additionalData
  });
};

/**
 * Async handler wrapper
 * 
 * This wrapper catches errors in async route handlers so we don't need
 * to wrap every handler in a try-catch block.
 * 
 * Instead of:
 * router.get('/route', async (req, res, next) => {
 *   try {
 *     // async code
 *   } catch (error) {
 *     next(error);
 *   }
 * });
 * 
 * We can write:
 * router.get('/route', asyncHandler(async (req, res) => {
 *   // async code
 * }));
 * 
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function that catches errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Not Found handler for undefined routes
 * 
 * Use this as the last route to catch any undefined endpoints.
 * Place it after all your other routes.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const notFound = (req, res, next) => {
  const error = new ErrorResponse(`Not found - ${req.originalUrl}`, 404);
  next(error);
};

/**
 * Global error handler middleware
 * 
 * This middleware catches all errors passed to next().
 * It formats the error response and ensures no sensitive information
 * (like stack traces) is exposed in production.
 * 
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const errorHandler = (err, req, res, next) => {
  // Default to 500 (internal server error) if no status code set
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  
  // Log the error for debugging (in development)
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', {
      message: err.message,
      stack: err.stack,
      statusCode
    });
  }
  
  // Handle specific error types
  
  // PostgreSQL unique constraint violations
  if (err.code === '23505') {
    statusCode = 400;
    message = 'A record with this value already exists';
  }
  
  // PostgreSQL foreign key violations
  if (err.code === '23503') {
    statusCode = 400;
    message = 'Referenced record does not exist';
  }
  
  // PostgreSQL connection errors
  if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'Database connection failed';
  }
  
  // JWT errors (handled by jsonwebtoken package)
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token has expired';
  }
  
  // In production, don't expose internal error details
  // This prevents attackers from learning about our system
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal Server Error';
  }
  
  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * Validation error formatter
 * 
 * Convert express-validator error arrays into a more friendly format.
 * 
 * @param {Array} errors - Array of validation errors
 * @returns {Object} Formatted error response
 */
const formatValidationErrors = (errors) => {
  return {
    success: false,
    message: 'Validation failed',
    errors: errors.map(error => ({
      field: error.path,
      message: error.msg
    }))
  };
};

module.exports = {
  ErrorResponse,
  createErrorResponse,
  asyncHandler,
  notFound,
  errorHandler,
  formatValidationErrors
};
