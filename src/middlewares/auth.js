/**
 * Authentication Middleware
 * 
 * This middleware protects routes by verifying JWT tokens.
 * Only requests with a valid token can access protected routes.
 * 
 * Key concepts for beginners:
 * - Middleware: Functions that run before the final request handler
 * - JWT Verification: Checking that the token is valid and not expired
 * - req.user: Passing authenticated user data to the next middleware/controller
 */

const jwt = require('jsonwebtoken');
const ErrorResponse = require('../utils/errorResponse');

/**
 * Protect routes - verify JWT token
 * 
 * This middleware checks the Authorization header for a valid token.
 * If valid, it adds the decoded user information to req.user.
 * If invalid or missing, it returns an appropriate error response.
 * 
 * Headers expected:
 * - Authorization: Bearer <token>
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Step 1: Extract token from Authorization header
    // The header format should be: "Bearer <token>"
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      // Get the token part after "Bearer "
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Step 2: Check if token exists
    if (!token) {
      return next(new ErrorResponse('Not authorized to access this route', 401));
    }
    
    try {
      // Step 3: Verify the token
      // jwt.verify() checks:
      // 1. That the token was signed with our secret key
      // 2. That the token hasn't expired
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Step 4: Add user info to request object
      // This allows downstream middleware/controllers to know who's making the request
      req.user = {
        userId: decoded.userId,
        email: decoded.email
      };
      
      // Move to the next middleware or controller
      next();
      
    } catch (err) {
      // Token verification failed
      if (err.name === 'TokenExpiredError') {
        return next(new ErrorResponse('Token has expired', 401));
      } else if (err.name === 'JsonWebTokenError') {
        return next(new ErrorResponse('Invalid token', 401));
      } else {
        return next(new ErrorResponse('Not authorized to access this route', 401));
      }
    }
    
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication middleware
 * 
 * Similar to protect(), but doesn't require a token.
 * If a valid token is provided, it adds user info to req.user.
 * If no token or invalid token, it continues without setting req.user.
 * 
 * Use this for routes that can be accessed by both authenticated and
 * unauthenticated users, but behave differently based on authentication.
 * 
 * Example: A route that shows general content to everyone, but
 * shows personalized content if logged in.
 */
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;
    
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = {
          userId: decoded.userId,
          email: decoded.email
        };
      } catch (err) {
        // Token is invalid, but that's okay - we continue without user
        // Don't call next(error) here - just proceed
      }
    }
    
    // Continue regardless of whether token was valid or not
    next();
    
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based authorization middleware
 * 
 * This is an extension that checks if the user has the required role.
 * Use it after the protect() middleware.
 * 
 * Example usage:
 * router.get('/admin', protect, authorize('admin'), adminController);
 * 
 * @param {...string} roles - Allowed roles for this route
 * @returns {Function} Middleware function
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // Check if user object exists (protect middleware should have run first)
    if (!req.user) {
      return next(new ErrorResponse('Not authorized to access this route', 401));
    }
    
    // Check if user's role is in the allowed roles array
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(`User role '${req.user.role}' is not authorized to access this route`, 403)
      );
    }
    
    next();
  };
};
