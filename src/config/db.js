/**
 * Database Configuration
 * 
 * This module handles the PostgreSQL database connection using the 'pg' driver.
 * It creates a connection pool that manages multiple database connections efficiently.
 * 
 * Key concepts for beginners:
 * - Connection Pool: Instead of creating a new connection for each request (which is slow),
 *   we maintain a pool of reusable connections. When a request needs the database,
 *   it borrows a connection from the pool, uses it, and returns it for others to use.
 * 
 * - Environment Variables: Database credentials should NEVER be hardcoded.
 *   We use dotenv to load them from a .env file, making the app configurable
 *   without changing code.
 */

const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool with configuration from environment variables
// This is the recommended way to connect to PostgreSQL from Node.js
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'nodeauth',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  
  // Maximum number of clients in the pool
  // More clients = more concurrent database operations supported
  // Adjust based on your expected traffic
  max: 20,
  
  // How long to wait before timing out when connecting (in milliseconds)
  // If the database is not responding, we don't want to hang forever
  connectionTimeoutMillis: 2000,
  
  // How long a client can be idle before being released (in milliseconds)
  // Helps close stale connections
  idleTimeoutMillis: 30000,
});

/**
 * Test the database connection
 * This is useful for checking if the database is accessible on startup
 */
const testConnection = async () => {
  try {
    // Get a client from the pool and run a simple query
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    
    // Log the current database time
    console.log(`✅ Database connected successfully! Server time: ${result.rows[0].now}`);
    
    // Release the client back to the pool (very important!)
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

/**
 * Execute a parameterized query
 * 
 * Why use parameterized queries?
 * - Security: Prevents SQL Injection attacks by separating SQL code from data
 * - Performance: The database can cache query execution plans
 * - Convenience: Automatic handling of special characters in values
 * 
 * @param {string} text - The SQL query with parameter placeholders ($1, $2, etc.)
 * @param {Array} params - Array of values to substitute into the query
 * @returns {Promise} Query result object
 */
const query = async (text, params) => {
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    
    // Log query performance in development (helps identify slow queries)
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', { text: text.substring(0, 100), duration, rows: result.rowCount });
    }
    
    return result;
  } catch (error) {
    // Add context to database errors for better debugging
    console.error('Database query error:', { query: text.substring(0, 100), error: error.message });
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 * 
 * Use this when you need to execute multiple queries as a single atomic operation.
 * A transaction ensures that either ALL queries succeed or NONE are applied.
 * 
 * Example use case: Transfer money between accounts
 * - Debit from account A
 * - Credit to account B
 * If either fails, the entire transaction is rolled back
 */
const getClient = async () => {
  const client = await pool.connect();
  
  // Wrap the client with transaction methods for convenience
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);
  
  // Set a timeout for queries on this client
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
  }, 5000);
  
  // Override release to clear timeout
  client.release = () => {
    clearTimeout(timeout);
    originalRelease();
  };
  
  return client;
};

// Export the pool and helper functions
module.exports = {
  pool,
  query,
  getClient,
  testConnection
};
