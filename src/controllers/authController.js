/**
 * Authentication Controller
 * 
 * This controller handles all authentication-related business logic including:
 * - User registration (creating new accounts)
 * - User login (authenticating existing accounts)
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
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 * 
 * Process:
 * 1. Validate input from request
 * 2. Check if user already exists
 * 3. Hash the password (security best practice)
 * 4. Insert user into database
 * 5. Generate JWT token
 * 6. Return response
 */
exports.register = async (req, res, next) => {
  try {
    // Step 1: Check for validation errors
    // express-validator middleware runs before this controller
    // If there are errors, they are stored in validationResult
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
    // We use a parameterized query to prevent SQL injection
    const userCheck = await query(
      'SELECT user_id FROM users WHERE user_email = $1',
      [email.toLowerCase()] // Always normalize email to lowercase
    );
    
    if (userCheck.rows.length > 0) {
      return next(new ErrorResponse('User with this email already exists', 400));
    }
    
    // Step 3: Hash the password
    // Why hash?
    // - If our database is compromised, attackers can't read actual passwords
    // - Hashing is one-way (can't reverse to get original password)
    // - We use bcrypt with a salt round of 10 (good balance of security and performance)
    // The salt makes each hash unique even for the same password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Step 4: Insert user into database
    const result = await query(
      `INSERT INTO users (user_name, user_email, user_password)
       VALUES ($1, $2, $3)
       RETURNING user_id, user_name, user_email, created_at`,
      [name, email.toLowerCase(), hashedPassword]
    );
    
    const user = result.rows[0];
    
    // Step 5: Generate JWT token
    const token = generateToken(user);
    
    // Step 6: Return response
    // We return the token so the user can immediately start making authenticated requests
    // We don't return the password (even though we have it hashed, it's a security best practice)
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user: {
          id: user.user_id,
          name: user.user_name,
          email: user.user_email,
          createdAt: user.created_at
        }
      }
    });
    
  } catch (error) {
    // Pass errors to Express error handler
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
 * 3. Compare passwords
 * 4. Generate JWT token
 * 5. Return response
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
    const result = await query(
      'SELECT user_id, user_name, user_email, user_password FROM users WHERE user_email = $1',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      // Use a generic error message to prevent user enumeration attacks
      // Telling attackers "email not found" helps them find valid emails
      return next(new ErrorResponse('Invalid credentials', 401));
    }
    
    const user = result.rows[0];
    
    // Step 3: Compare passwords
    // bcrypt.compare() handles the complexity of comparing hashed passwords
    // It automatically handles the salt that was used during hashing
    const isMatch = await bcrypt.compare(password, user.user_password);
    
    if (!isMatch) {
      // Same generic error as above - don't reveal which credential is wrong
      return next(new ErrorResponse('Invalid credentials', 401));
    }
    
    // Step 4: Generate JWT token
    const token = generateToken(user);
    
    // Step 5: Return response
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.user_id,
          name: user.user_name,
          email: user.user_email
        }
      }
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
    // It contains the userId from the JWT payload
    const result = await query(
      `SELECT user_id, user_name, user_email, created_at, updated_at
       FROM users WHERE user_id = $1`,
      [req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return next(new ErrorResponse('User not found', 404));
    }
    
    const user = result.rows[0];
    
    res.status(200).json({
      success: true,
      data: {
        id: user.user_id,
        name: user.user_name,
        email: user.user_email,
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
    // For stateless JWT authentication, we don't need to do anything server-side
    // The client simply discards the token
    // This endpoint confirms the logout was processed
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully. Please remove the token from client storage.'
    });
    
  } catch (error) {
    next(error);
  }
};
