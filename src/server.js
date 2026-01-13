/**
 * Server Entry Point
 * 
 * This is the starting point of the application.
 * It initializes the database connection and starts the HTTP server.
 * 
 * Key concepts for beginners:
 * - Entry Point: The first code that runs when the application starts
 * - Database Connection: Establishing connection to PostgreSQL
 * - Server Startup: Listening for incoming HTTP requests
 */

const app = require('./app');
const { testConnection } = require('./config/db');

require('dotenv').config();

/**
 * Configuration
 */
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Start the server
 * 
 * This function:
 * 1. Tests database connection
 * 2. Starts the HTTP server if DB connection succeeds
 * 3. Handles startup errors gracefully
 */
const startServer = async () => {
  try {
    console.log('🚀 Starting Node Auth Backend...\n');
    
    // Test database connection before starting the server
    console.log('📦 Connecting to database...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('\n❌ Failed to connect to database. Please check your configuration.');
      console.log('   Make sure PostgreSQL is running and your .env file is correct.\n');
      process.exit(1);
    }
    
    // Start listening for requests
    app.listen(PORT, HOST, () => {
      console.log(`✅ Server is running on http://${HOST}:${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('\n📋 Available endpoints:');
      console.log(`   GET  /              - API information`);
      console.log(`   GET  /health        - Health check`);
      console.log(`   POST /api/auth/register - Register new user`);
      console.log(`   POST /api/auth/login   - Login user`);
      console.log(`   GET  /api/auth/me      - Get current user profile`);
      console.log(`   POST /api/auth/logout  - Logout user`);
      console.log('\n🛑 Press Ctrl+C to stop the server\n');
    });
    
  } catch (error) {
    console.error('\n❌ Failed to start server:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

/**
 * Handle graceful shutdown
 * 
 * When the process receives termination signals (like Ctrl+C),
 * we want to close database connections before exiting.
 */
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  try {
    // Close database pool
    const { pool } = require('./config/db');
    await pool.end();
    console.log('✅ Database connections closed.');
    
    // Exit the process
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error.message);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit on unhandled rejections - just log them
  // In production, you might want to exit or notify monitoring
});

// Start the server
startServer();
