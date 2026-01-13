/**
 * Express Application Setup
 * 
 * This is the main Express application configuration file.
 * It sets up middleware, routes, and error handling.
 * 
 * Key concepts for beginners:
 * - Middleware: Functions that process requests before they reach controllers
 * - Routing: Mapping HTTP requests to handler functions
 * - Error Handling: Centralized handling of errors across the application
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');

// Import rate limiting middleware
const { generalLimiter, authLimiter } = require('./middlewares/rateLimiter');

// Import error handling utilities
const { notFound, errorHandler } = require('./utils/errorResponse');

// Create Express app
const app = express();

// Trust proxy (for when behind a reverse proxy like nginx)
// This ensures req.ip is correctly set
app.set('trust proxy', 1);

/**
 * Middleware Setup
 * 
 * Middleware functions are executed in the order they're defined.
 * Order matters!
 */

// Rate Limiting - Apply general rate limit to all routes
// This protects the API from abuse and denial-of-service attacks
// The health check endpoint is automatically skipped by the limiter
app.use(generalLimiter);

// CORS - Enable Cross-Origin Resource Sharing
// This allows frontend applications from different domains to access this API
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true, // Allow cookies/auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser - Parse JSON request bodies
// This allows us to access req.body for POST/PUT requests
app.use(express.json());

// Body parser - Parse URL-encoded data (form submissions)
// extended: true allows rich objects and arrays to be encoded
app.use(express.urlencoded({ extended: true }));

// Request logging - Log incoming requests (useful for debugging)
app.use((req, res, next) => {
  // Log request method, URL, and time in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  }
  next();
});

/**
 * API Routes
 * 
 * We organize routes by resource (auth, users, etc.)
 * All routes are prefixed with /api for API versioning
 */

// Health check endpoint - Useful for monitoring and load balancers
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Mount authentication routes under /api/auth
// Apply stricter rate limiting specifically to authentication endpoints
// This protects against brute force attacks on login and registration
app.use('/api/auth', authLimiter, authRoutes);

// Example of how you might add more routes:
// app.use('/api/users', userRoutes);
// app.use('/api/products', productRoutes);

/**
 * Root endpoint - API information
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Node Auth Backend API',
    version: '1.0.0',
    description: 'A basic authentication backend with Node.js and PostgreSQL',
    endpoints: {
      health: '/health',
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      me: 'GET /api/auth/me',
      logout: 'POST /api/auth/logout'
    },
    documentation: 'See README.md for detailed API documentation'
  });
});

/**
 * 404 Handler - Catch undefined routes
 * 
 * This must come AFTER all valid routes.
 * If a request comes in that doesn't match any route, it ends up here.
 */
app.use(notFound);

/**
 * Global Error Handler
 * 
 * This middleware catches all errors passed to next().
 * It provides consistent error responses and prevents
 * sensitive error details from being exposed.
 */
app.use(errorHandler);

module.exports = app;
