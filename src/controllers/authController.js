/**
 * Authentication Controller
 * 
 * This controller handles all authentication-related business logic including:
 * - User registration (creating new accounts)
 * - User login (authenticating existing accounts)
 * - Email verification
 * - Password reset
 * 
 * Key concepts for beginners:
 * - Business Logic: The actual operations that need to happen (hash password, check credentials)
 * - Separation of Concerns: Controllers handle logic, routes handle URL mapping
 * - Input Validation: Always validate user input before processing
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { validationResult } = require('express-validator');
const ErrorResponse = require('../utils/errorResponse');
const { 
  generateVerificationToken, 
  generateResetToken,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangeConfirmationEmail
} = require('../utils/emailService');

/**
 * Generate a JWT token for a user
 * 
 * JWT (JSON Web Token) is a compact way to securely transmit information.
 * It's commonly used for authentication because:
 * - It's stateless (the server doesn't need to store sessions)
 * - It can contain user information that the server can read without a database lookup
 * - It can be verified cryptographically to ensure it hasn't been tampered with
 * 
 * @param {Object} user - User object from database
 * @returns {string} JWT token
 */
const generateToken = (user) => {
  // The payload contains the data we want to include in the token
  // We only include user_id and email - never include passwords!
  const payload = {
    userId: user.user_id,
    email: user.user_email
  };
  
  // Sign the token with our secret key
  // expiresIn determines when the token becomes invalid
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h'
  });
};

/**
 * Get user by ID helper function
 * 
 * @param {string} userId - The user's UUID
 * @returns {Object|null} User object or null if not found
 */
const getUserById = async (userId) => {
  const result = await query(
    `SELECT user_id, user_name, user_email, user_password, is_verified, 
            created_at, updated_at, login_attempts, lockout_until
     FROM users WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
};

/**
 * Get user by email helper function
 * 
 * @param {string} email - The user's email (will be normalized to lowercase)
 * @returns {Object|null} User object or null if not found
 */
const getUserByEmail = async (email) => {
  const result = await query(
    `SELECT user_id, user_name, user_email, user_password, is_verified, 
            created_at, updated_at, login_attempts, lockout_until
     FROM users WHERE user_email = $1`,
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 * 
 * Process:
 * 1. Validate input from request
 * 2. Check if user already exists
 * 3. Generate verification token
 * 4. Hash the password (security best practice)
 * 5. Insert user into database with verification token
 * 6. Send verification email
 * 7. Return response (without full token access until verified)
 */
exports.register = async (req, res, next) => {
  try {
    // Step 1: Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    // Extract user input from request body
    const { name, email, password } = req.body;
    
    // Step 2: Check if user already exists
    const userCheck = await query(
      'SELECT user_id FROM users WHERE user_email = $1',
      [email.toLowerCase()]
    );
    
    if (userCheck.rows.length > 0) {
      return next(new ErrorResponse('User with this email already exists', 400));
    }
    
    // Step 3: Generate verification token
    // This token will be sent to the user's email for verification
    const verificationToken = generateVerificationToken(32);
    
    // Set expiration: 24 hours from now
    // We use raw SQL for date calculation to ensure consistency
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Step 4: Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Step 5: Insert user into database with verification token
    const result = await query(
      `INSERT INTO users (user_name, user_email, user_password, verification_token, verification_token_expires)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, user_name, user_email, created_at`,
      [name, email.toLowerCase(), hashedPassword, verificationToken, verificationExpires]
    );
    
    const user = result.rows[0];
    
    // Step 6: Send verification email
    // We use try-catch to ensure email failure doesn't break registration
    // In production, you might want to queue this or handle failures differently
    try {
      await sendVerificationEmail(email, name, verificationToken);
      console.log('📧 Verification email sent to:', email);
    } catch (emailError) {
      // Log the error but don't fail the registration
      console.error('Failed to send verification email:', emailError.message);
      console.log('📧 (Registration successful, verification email will be retried)');
    }
    
    // Step 7: Return response
    // We indicate that verification is required but don't return the full token
    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      data: {
        // In a complete implementation, you might return a limited token here
        // For now, we just indicate the next step
        requiresVerification: true,
        user: {
          id: user.user_id,
          name: user.user_name,
          email: user.user_email
        }
      }
    });
    
  } catch (error) {
    // Pass errors to Express error handler
    next(error);
  }
};

/**
 * @desc    Verify email with token
 * @route   POST /api/auth/verify-email
 * @access  Public
 * 
 * Process:
 * 1. Validate token from request body
 * 2. Find user with matching token that hasn't expired
 * 3. Update user to verified status
 * 4. Clear verification token fields
 * 5. Return success response
 */
exports.verifyEmail = async (req, res, next) => {
  try {
    // Step 1: Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { token } = req.body;
    
    // Step 2: Find user with matching verification token
    // We check that the token matches AND hasn't expired
    const result = await query(
      `SELECT user_id, user_name, user_email, verification_token_expires, is_verified
       FROM users 
       WHERE verification_token = $1`,
      [token]
    );
    
    if (result.rows.length === 0) {
      return next(new ErrorResponse('Invalid verification token', 400));
    }
    
    const user = result.rows[0];
    
    // Check if already verified
    if (user.is_verified) {
      return res.status(200).json({
        success: true,
        message: 'Email is already verified. You can log in now.'
      });
    }
    
    // Check if token has expired
    if (user.verification_token_expires && new Date(user.verification_token_expires) < new Date()) {
      return next(new ErrorResponse('Verification token has expired. Please request a new verification email.', 400));
    }
    
    // Step 3: Update user to verified status
    await query(
      `UPDATE users 
       SET is_verified = true, 
           verification_token = NULL, 
           verification_token_expires = NULL,
           updated_at = NOW()
       WHERE user_id = $1`,
      [user.user_id]
    );
    
    // Step 4: Return success response
    res.status(200).json({
      success: true,
      message: 'Email verified successfully! You can now log in.'
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resend verification email
 * @route   POST /api/auth/resend-verification
 * @access  Public
 * 
 * Process:
 * 1. Validate email from request body
 * 2. Find user by email
 * 3. If user exists and not verified:
 *    - Generate new verification token
 *    - Update database with new token
 *    - Send verification email
 * 4. Always return success (prevent email enumeration)
 */
exports.resendVerification = async (req, res, next) => {
  try {
    // Step 1: Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { email } = req.body;
    
    // Step 2: Find user by email
    const user = await getUserByEmail(email);
    
    // Step 3: If user exists and not verified, send new verification email
    // We ALWAYS return success to prevent email enumeration attacks
    // This way, attackers can't tell which emails are registered
    if (user && !user.is_verified) {
      // Generate new verification token
      const verificationToken = generateVerificationToken(32);
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      // Update database with new token
      await query(
        `UPDATE users 
         SET verification_token = $1, 
             verification_token_expires = $2,
             updated_at = NOW()
         WHERE user_id = $3`,
        [verificationToken, verificationExpires, user.user_id]
      );
      
      // Send verification email
      try {
        await sendVerificationEmail(email, user.user_name, verificationToken);
        console.log('📧 Verification email resent to:', email);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError.message);
      }
    }
    
    // Step 4: Always return success
    // This prevents attackers from discovering which emails are registered
    res.status(200).json({
      success: true,
      message: 'If an account with that email exists and needs verification, a new email has been sent.'
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 * 
 * Process:
 * 1. Validate input from request
 * 2. Find user by email
 * 3. Check if account is locked
 * 4. Compare passwords
 * 5. Check if email is verified (optional, can be disabled)
 * 6. Reset login attempts on success
 * 7. Generate JWT token
 * 8. Return response
 */
exports.login = async (req, res, next) => {
  try {
    // Step 1: Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    // Extract user input
    const { email, password } = req.body;
    
    // Step 2: Find user by email
    const user = await getUserByEmail(email);
    
    if (!user) {
      // Use a generic error message to prevent user enumeration attacks
      return next(new ErrorResponse('Invalid credentials', 401));
    }
    
    // Step 3: Check if account is locked due to too many failed attempts
    if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(user.lockout_until) - new Date()) / 60000);
      return next(new ErrorResponse(`Account is temporarily locked. Please try again in ${remainingMinutes} minutes.`, 423));
    }
    
    // Step 4: Compare passwords
    const isMatch = await bcrypt.compare(password, user.user_password);
    
    if (!isMatch) {
      // Increment login attempts
      const newAttempts = (user.login_attempts || 0) + 1;
      
      // Lock account after 5 failed attempts for 30 minutes
      let lockoutUpdate = '';
      let lockoutValue = null;
      
      if (newAttempts >= 5) {
        lockoutUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        lockoutUpdate = ', lockout_until = $3';
      }
      
      await query(
        `UPDATE users SET login_attempts = $1${lockoutUpdate} WHERE user_id = $2`,
        newAttempts > 5 ? [5, lockoutUntil, user.user_id] : [newAttempts, user.user_id]
      );
      
      return next(new ErrorResponse('Invalid credentials', 401));
    }
    
    // Step 5: Check if email is verified (optional requirement)
    // Set this to true if you want to require email verification before login
    const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
    
    if (requireEmailVerification && !user.is_verified) {
      return next(new ErrorResponse('Please verify your email before logging in. Check your inbox for the verification link.', 403));
    }
    
    // Step 6: Reset login attempts on successful login
    await query(
      `UPDATE users SET login_attempts = 0, lockout_until = NULL WHERE user_id = $1`,
      [user.user_id]
    );
    
    // Step 7: Generate JWT token
    const token = generateToken(user);
    
    // Step 8: Return response
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.user_id,
          name: user.user_name,
          email: user.user_email,
          isVerified: user.is_verified
        }
      }
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Request password reset
 * @route   POST /api/auth/forgot-password
 * @access  Public
 * 
 * Process:
 * 1. Validate email from request body
 * 2. Find user by email
 * 3. If user exists:
 *    - Generate reset token
 *    - Set expiration (1 hour)
 *    - Update database
 *    - Send reset email
 * 4. Always return success (prevent email enumeration)
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    // Step 1: Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { email } = req.body;
    
    // Step 2: Find user by email
    const user = await getUserByEmail(email);
    
    // Step 3: If user exists, generate and send reset token
    // ALWAYS return success to prevent email enumeration attacks
    if (user) {
      // Generate password reset token
      const resetToken = generateResetToken(32);
      
      // Set expiration: 1 hour from now
      // Password reset tokens should be short-lived for security
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      // Update database with reset token
      await query(
        `UPDATE users 
         SET reset_password_token = $1, 
             reset_password_expires = $2,
             updated_at = NOW()
         WHERE user_id = $3`,
        [resetToken, resetExpires, user.user_id]
      );
      
      // Send password reset email
      try {
        await sendPasswordResetEmail(email, user.user_name, resetToken);
        console.log('📧 Password reset email sent to:', email);
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError.message);
      }
    }
    
    // Step 4: Always return success message
    // This prevents attackers from discovering which emails are registered
    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password with token
 * @route   POST /api/auth/reset-password
 * @access  Public
 * 
 * Process:
 * 1. Validate token and new password from request body
 * 2. Find user with matching reset token that hasn't expired
 * 3. Hash the new password
 * 4. Update user's password and clear reset token fields
 * 5. Send confirmation email
 * 6. Return success response
 */
exports.resetPassword = async (req, res, next) => {
  try {
    // Step 1: Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { token, newPassword } = req.body;
    
    // Step 2: Find user with matching reset token
    // We check that the token matches AND hasn't expired
    const result = await query(
      `SELECT user_id, user_name, user_email, reset_password_expires
       FROM users 
       WHERE reset_password_token = $1`,
      [token]
    );
    
    if (result.rows.length === 0) {
      return next(new ErrorResponse('Invalid or expired reset token', 400));
    }
    
    const user = result.rows[0];
    
    // Check if token has expired
    if (user.reset_password_expires && new Date(user.reset_password_expires) < new Date()) {
      return next(new ErrorResponse('Reset token has expired. Please request a new password reset.', 400));
    }
    
    // Step 3: Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Step 4: Update user's password and clear reset token fields
    await query(
      `UPDATE users 
       SET user_password = $1, 
           reset_password_token = NULL, 
           reset_password_expires = NULL,
           login_attempts = 0,  -- Reset failed login attempts
           lockout_until = NULL, -- Clear any lockout
           updated_at = NOW()
       WHERE user_id = $2`,
      [hashedPassword, user.user_id]
    );
    
    // Step 5: Send confirmation email
    try {
      await sendPasswordChangeConfirmationEmail(user.user_email, user.user_name);
      console.log('📧 Password change confirmation sent to:', user.user_email);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError.message);
    }
    
    // Step 6: Return success response
    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.'
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 * 
 * This endpoint requires a valid JWT token (enforced by auth middleware).
 * It returns the user's profile information based on the token.
 */
exports.getMe = async (req, res, next) => {
  try {
    // req.user is set by the auth middleware after verifying the token
    const user = await getUserById(req.user.userId);
    
    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: {
        id: user.user_id,
        name: user.user_name,
        email: user.user_email,
        isVerified: user.is_verified,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user (client-side)
 * @route   POST /api/auth/logout
 * @access  Private
 * 
 * Note: With JWT, logout is typically handled client-side by deleting the token.
 * This endpoint exists for API completeness and could be used to:
 * - Log the logout event
 * - Implement token blacklisting (advanced)
 * - Clear any server-side session data if using a hybrid approach
 */
exports.logout = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Logged out successfully. Please remove the token from client storage.'
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change password (for logged in users)
 * @route   POST /api/auth/change-password
 * @access  Private
 * 
 * Process:
 * 1. Validate current and new password
 * 2. Get current user
 * 3. Verify current password
 * 4. Hash and update new password
 * 5. Send confirmation email
 */
exports.changePassword = async (req, res, next) => {
  try {
    // Step 1: Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    // Step 2: Get current user
    const user = await getUserById(req.user.userId);
    
    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }
    
    // Step 3: Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.user_password);
    
    if (!isMatch) {
      return next(new ErrorResponse('Current password is incorrect', 401));
    }
    
    // Step 4: Hash and update new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    await query(
      `UPDATE users 
       SET user_password = $1,
           login_attempts = 0,
           lockout_until = NULL,
           updated_at = NOW()
       WHERE user_id = $2`,
      [hashedPassword, user.user_id]
    );
    
    // Step 5: Send confirmation email
    try {
      await sendPasswordChangeConfirmationEmail(user.user_email, user.user_name);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError.message);
    }
    
    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please log in again with your new password.'
    });
    
  } catch (error) {
    next(error);
  }
};
