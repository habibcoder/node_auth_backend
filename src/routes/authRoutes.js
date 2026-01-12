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
 * POST   /api/auth/register   - Create new user account
 * POST   /api/auth/login      - Authenticate and get token
 * GET    /api/auth/me         - Get current user's profile (protected)
 * POST   /api/auth/logout     - Log out (client-side token removal)
 */

const express = require('express');
const router = express.Router();

// Import controllers - these contain the actual logic
const authController = require('../controllers/authController');

// Import validation middleware
const {
  registerValidation,
  loginValidation,
  handleValidation
} = require('../middlewares/validation');

// Import authentication middleware
const { protect } = require('../middlewares/auth');

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
 *   "message": "User registered successfully",
 *   "data": {
 *     "token": "jwt_token_here",
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
  registerValidation,      // Validate input first
  handleValidation,        // Check for validation errors
  authController.register  // Then call the controller
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
 *       "email": "john@example.com"
 *     }
 *   }
 * }
 */
router.post(
  '/login',
  loginValidation,         // Validate input first
  handleValidation,        // Check for validation errors
  authController.login     // Then call the controller
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
 *     "createdAt": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 */
router.get(
  '/me',
  protect,                 // Require authentication
  authController.getMe     // Get user profile
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
 *   "message": "Logged out successfully"
 * }
 */
router.post(
  '/logout',
  protect,
  authController.logout
);

module.exports = router;
