/**
 * Validation Middleware
 * 
 * This middleware validates incoming request data using express-validator.
 * It ensures that user input meets our requirements before processing.
 * 
 * Key concepts for beginners:
 * - Input Validation: Always validate user input - never trust it!
 * - Sanitization: Cleaning user input to prevent injection attacks
 * - Error Collection: Gathering all validation errors at once (not failing fast)
 * 
 * Why validate?
 * - Security: Prevents SQL injection, XSS, and other attacks
 * - Data Integrity: Ensures we store valid data in our database
 * - User Experience: Provides immediate feedback on what's wrong
 */

const { body, validationResult } = require('express-validator');

/**
 * Validation rules for user registration
 * These rules define what constitutes valid registration data
 */
exports.registerValidation = [
  // Name validation
  body('name')
    .trim() // Remove whitespace from both ends
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters')
    .matches(/^[a-zA-Z\s]+$/).withMessage('Name can only contain letters and spaces'),
  
  // Email validation
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail() // Converts to lowercase and standardizes format
    .isLength({ max: 255 }).withMessage('Email must be less than 255 characters'),
  
  // Password validation
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter')
];

/**
 * Validation rules for user login
 * Simpler than registration since we only need email and password
 */
exports.loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
];

/**
 * Validation rules for user profile update
 * Only validates fields that are provided (partial updates)
 */
exports.updateProfileValidation = [
  body('name')
    .optional() // Field is not required
    .trim()
    .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters')
    .matches(/^[a-zA-Z\s]+$/).withMessage('Name can only contain letters and spaces'),
  
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email must be less than 255 characters')
];

/**
 * Validation rules for password change
 * Requires both current password and new password
 */
exports.changePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter')
    .custom((value, { req }) => {
      // Additional check: new password can't be same as current
      if (value === req.body.currentPassword) {
        throw new Error('New password cannot be the same as current password');
      }
      return true;
    })
];

/**
 * Middleware to check validation results
 * 
 * This middleware should be placed AFTER the validation rules in the route.
 * It checks if any validation errors occurred and returns them if so.
 * 
 * Usage in route:
 * router.post('/register', registerValidation, this.handleValidation, registerController);
 */
exports.handleValidation = (req, res, next) => {
  // Collect all validation errors
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Format errors for the response
    const formattedErrors = errors.array().map(error => ({
      field: error.path, // The field that has the error
      message: error.msg, // User-friendly error message
      value: error.value // The value that was provided
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors
    });
  }
  
  // No errors - proceed to the next middleware/controller
  next();
};

/**
 * Custom validation helper for checking unique fields
 * 
 * Use this when you need to check if a value is unique in the database.
 * Example: Checking if an email is already registered.
 * 
 * @param {string} table - Database table name
 * @param {string} field - Field name to check
 * @param {string} message - Error message if validation fails
 * @param {Function} getValue - Function to extract value from request
 */
exports.uniqueValidator = (table, field, message, getValue) => {
  return async (req, res, next) => {
    const { query } = require('../config/db');
    const value = getValue(req);
    
    try {
      const result = await query(
        `SELECT ${field} FROM ${table} WHERE ${field} = $1`,
        [value]
      );
      
      if (result.rows.length > 0) {
        return res.status(400).json({
          success: false,
          errors: [{ field, message }]
        });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Sanitization middleware
 * 
 * In addition to validation, we should sanitize input to prevent
 * any malicious code from being stored or executed.
 * 
 * express-validator provides various sanitizers:
 * - trim() - Remove whitespace
 * - escape() - Convert special characters to HTML entities
 * - toLowerCase() / toUpperCase() - Change case
 * - normalizeEmail() - Standardize email format
 * - stripLow() - Remove low-order characters
 */
exports.sanitizeInput = (req, res, next) => {
  // Sanitize request body
  if (req.body) {
    // Trim all string values
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }
  
  next();
};

/**
 * Validation rules for email verification
 * Validates the token received in the verification email
 */
exports.verifyEmailValidation = [
  body('token')
    .trim()
    .notEmpty().withMessage('Verification token is required')
    .isLength({ min: 64, max: 64 }).withMessage('Invalid verification token format')
    // Token should be a hex string (64 chars = 32 bytes in hex)
    .matches(/^[a-f0-9]+$/).withMessage('Invalid verification token format')
];

/**
 * Validation rules for resending verification email
 * Similar to login - just needs email
 */
exports.resendVerificationValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email must be less than 255 characters')
];

/**
 * Validation rules for forgot password request
 * Just needs the email address
 */
exports.forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email must be less than 255 characters')
];

/**
 * Validation rules for password reset
 * Validates the token and new password
 */
exports.resetPasswordValidation = [
  body('token')
    .trim()
    .notEmpty().withMessage('Reset token is required')
    .isLength({ min: 64, max: 64 }).withMessage('Invalid reset token format')
    .matches(/^[a-f0-9]+$/).withMessage('Invalid reset token format'),
  
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character')
];
