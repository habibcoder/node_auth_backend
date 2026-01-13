/**
 * Rate Limiting Middleware
 * 
 * This module implements rate limiting to protect the API from abuse,
 * brute force attacks, and denial-of-service attacks.
 * 
 * Key concepts for beginners:
 * - Rate Limiting: Restricting how many requests a client can make within a time window
 * - Sliding Window: Using a moving time window to count requests
 * - IP-based Limiting: Identifying clients by their IP address
 * 
 * Why rate limiting is important for authentication:
 * - Prevents brute force password guessing attacks on login endpoint
 * - Prevents automated registration spam
 * - Protects against denial-of-service attacks
 * - Ensures fair resource usage among all clients
 */

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

/**
 * Create a rate limiter with custom configuration
 * 
 * @param {Object} options - Rate limiter options
 * @returns {Function} Express middleware function
 */
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // Default: 15 minutes
    max = 100, // Default: 100 requests per window
    message = 'Too many requests, please try again later',
    standardHeaders = true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders = false, // Disable `X-RateLimit-*` headers
    keyGenerator = (req) => {
      // Use IP address as the rate limit key
      // This ensures each client gets their own rate limit
      // req.ip is set by Express and handles proxied requests properly
      // return req.ip;

      // Properly normalize IPv4 + IPv6 addresses
      return ipKeyGenerator(req);
    },
    handler = (req, res, next, options) => {
      res.status(429).json({
        success: false,
        message: options.message,
        retryAfter: Math.ceil(options.windowMs / 1000) // Seconds until reset
      });
    },
    skip = (req) => {
      // Skip rate limiting for health check endpoint
      // Health checks are frequent and shouldn't count against the limit
      return req.path === '/health';
    }
  } = options;

  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders,
    legacyHeaders,
    keyGenerator,
    handler,
    skip
  });
};

/**
 * General API Rate Limiter
 * 
 * Applies to all routes that don't have specific rate limiting.
 * Allows 100 requests per 15 minutes, which is reasonable for normal API usage.
 * 
 * This protects the API from general abuse while allowing legitimate traffic.
 */
const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

/**
 * Authentication Routes Rate Limiter (Stricter)
 * 
 * Applies specifically to authentication endpoints (login, register).
 * Uses a stricter limit because these endpoints are targets for brute force attacks.
 * 
 * Security considerations:
 * - Login endpoints are prime targets for password guessing attacks
 * - Registration endpoints can be used for spam account creation
 * - Lower limits make automated attacks much slower and less effective
 * - 5 requests per 15 minutes is still reasonable for legitimate users
 */
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 authentication attempts per 15 minutes per IP
  message: 'Too many authentication attempts, please try again after 15 minutes'
});

/**
 * Strict Rate Limiter for Failed Login Attempts
 * 
 * This is even more restrictive and can be applied after detecting
 * multiple failed login attempts from the same IP or user.
 * 
 * This creates a progressive defense:
 * - First 5 attempts: Normal rate limit applies
 * - After failures: Stricter limit kicks in
 * - After too many failures: Account can be temporarily locked
 * 
 * Usage: Apply this to requests that have already failed authentication
 */
const failedAuthLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Only 10 attempts per hour after failures
  message: 'Multiple failed attempts detected. Please wait 1 hour before trying again.',
  skip: (req) => {
    // Don't apply to health check
    return req.path === '/health';
  }
});

/**
 * Custom rate limiter factory for specific scenarios
 * 
 * This allows creating custom rate limiters with different configurations
 * for different use cases.
 * 
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMinutes - Time window in minutes
 * @param {string} customMessage - Custom error message
 * @returns {Function} Rate limiter middleware
 */
const customLimiter = (maxRequests, windowMinutes, customMessage) => {
  return createRateLimiter({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: customMessage
  });
};

/**
 * Rate limiter for development/debugging
 * 
 * Allows more requests for testing and development purposes.
 * Should NOT be used in production.
 */
const devLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // Allow many requests in development
  message: 'Development mode: Rate limit exceeded',
  skip: (req) => {
    // Only skip in development environment
    return process.env.NODE_ENV !== 'production' && req.path === '/health';
  }
});

module.exports = {
  createRateLimiter,
  generalLimiter,
  authLimiter,
  failedAuthLimiter,
  customLimiter,
  devLimiter
};
