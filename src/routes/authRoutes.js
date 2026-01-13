/**
 * Authentication Routes
 * 
 * This file defines the API endpoints for authentication operations.
 * Routes are organized by resource (auth) and HTTP method.
 * 
 * Key concepts for beginners:
 * - Route Definition: Mapping URLs to controller functions
 * - Middleware Chain: Applying validation and authentication in order
 * - RESTful Design: Using standard HTTP methods and status codes
 * 
 * Route structure:
 * POST   /api/auth/register         - Create new user account
 * POST   /api/auth/login            - Authenticate and get token
 * POST   /api/auth/verify-email     - Verify email with token
 * POST   /api/auth/resend-verification - Resend verification email
 * POST   /api/auth/forgot-password  - Request password reset
 * POST   /api/auth/reset-password   - Reset password with token
 * POST   /api/auth/change-password  - Change password (logged in user)
 * GET    /api/auth/me               - Get current user's profile (protected)
 * POST   /api/auth/logout           - Log out (client-side token removal)
 */

const express = require('express');
const router = express.Router();

// Import controllers - these contain the actual logic
const authController = require('../controllers/authController');

// Import validation middleware
const {
  registerValidation,
  loginValidation,
  changePasswordValidation,
  verifyEmailValidation,
  resendVerificationValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  handleValidation
} = require('../middlewares/validation');

// Import authentication middleware
const { protect, requireVerified } = require('../middlewares/auth');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 * 
 * Request body:
 * {
 *   "name": "John Doe",
 *   "email": "john@example.com",
 *   "password": "securepassword123"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "User registered successfully. Please check your email to verify your account.",
 *   "data": {
 *     "requiresVerification": true,
 *     "user": {
 *       "id": "uuid",
 *       "name": "John Doe",
 *       "email": "john@example.com"
 *     }
 *   }
 * }
 */
router.post(
  '/register',
  registerValidation,
  handleValidation,
  authController.register
);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email address with token
 * @access  Public
 * 
 * Request body:
 * {
 *   "token": "verification_token_from_email"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Email verified successfully! You can now log in."
 * }
 */
router.post(
  '/verify-email',
  verifyEmailValidation,
  handleValidation,
  authController.verifyEmail
);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend verification email
 * @access  Public
 * 
 * Request body:
 * {
 *   "email": "john@example.com"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "If an account with that email exists and needs verification, a new email has been sent."
 * }
 * 
 * Note: Always returns success to prevent email enumeration attacks
 */
router.post(
  '/resend-verification',
  resendVerificationValidation,
  handleValidation,
  authController.resendVerification
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and get token
 * @access  Public
 * 
 * Request body:
 * {
 *   "email": "john@example.com",
 *   "password": "securepassword123"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Login successful",
 *   "data": {
 *     "token": "jwt_token_here",
 *     "user": {
 *       "id": "uuid",
 *       "name": "John Doe",
 *       "email": "john@example.com",
 *       "isVerified": true
 *     }
 *   }
 * }
 */
router.post(
  '/login',
  loginValidation,
  handleValidation,
  authController.login
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 * 
 * Request body:
 * {
 *   "email": "john@example.com"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "If an account with that email exists, a password reset link has been sent."
 * }
 * 
 * Note: Always returns success to prevent email enumeration attacks.
 * The actual email is only sent if the email exists in our database.
 */
router.post(
  '/forgot-password',
  forgotPasswordValidation,
  handleValidation,
  authController.forgotPassword
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with valid token
 * @access  Public
 * 
 * Request body:
 * {
 *   "token": "reset_token_from_email",
 *   "newPassword": "NewSecurePassword123!"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Password has been reset successfully. Please log in with your new password."
 * }
 * 
 * Security notes:
 * - Token expires after 1 hour
 * - After reset, the old password will no longer work
 * - All active sessions will be invalidated
 */
router.post(
  '/reset-password',
  resetPasswordValidation,
  handleValidation,
  authController.resetPassword
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password for logged in user
 * @access  Private (requires authentication)
 * 
 * Headers:
 * {
 *   "Authorization": "Bearer <token>"
 * }
 * 
 * Request body:
 * {
 *   "currentPassword": "oldpassword123",
 *   "newPassword": "NewSecurePassword123!"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Password changed successfully. Please log in again with your new password."
 * }
 * 
 * Security notes:
 * - Requires current password for verification
 * - After change, user needs to log in again
 * - Old token will be invalid
 */
router.post(
  '/change-password',
  protect,
  changePasswordValidation,
  handleValidation,
  authController.changePassword
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user's profile
 * @access  Private (requires authentication)
 * 
 * Headers:
 * {
 *   "Authorization": "Bearer <token>"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "name": "John Doe",
 *     "email": "john@example.com",
 *     "isVerified": true,
 *     "createdAt": "2024-01-01T00:00:00.000Z",
 *     "updatedAt": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 */
router.get(
  '/me',
  protect,
  authController.getMe
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private (requires authentication)
 * 
 * Headers:
 * {
 *   "Authorization": "Bearer <token>"
 * }
 * 
 * Note: With JWT, logout is handled client-side by deleting the token.
 * This endpoint exists for API completeness and logging purposes.
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Logged out successfully. Please remove the token from client storage."
 * }
 */
router.post(
  '/logout',
  protect,
  authController.logout
);

module.exports = router;
