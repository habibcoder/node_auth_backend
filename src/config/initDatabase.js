/**
 * Database Initialization Script
 * 
 * This script initializes the PostgreSQL database by creating the necessary tables.
 * Run this script once before starting the application for the first time.
 * 
 * How to use:
 * 1. Make sure PostgreSQL is running
 * 2. Create a database named 'nodeauth' (or whatever you set in DB_NAME)
 * 3. Run: npm run init-db
 * 
 * Or manually execute the commands in database.sql using psql or pgAdmin:
 * psql -U postgres -d nodeauth -f database.sql
 */

const fs = require('fs');
const path = require('path');
const { pool, testConnection } = require('./db');

/**
 * Read and execute the SQL initialization script
 */
const initializeDatabase = async () => {
  console.log('🚀 Starting database initialization...\n');
  
  // Test database connection first
  const connected = await testConnection();
  if (!connected) {
    console.error('\n❌ Please make sure PostgreSQL is running and your .env file is configured correctly.');
    console.log('   Check .env.example for the required configuration.');
    process.exit(1);
  }

  try {
    // Read the SQL initialization script
    const sqlFilePath = path.join(__dirname, '..', '..', 'database.sql');
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Split by semicolons to execute each statement separately
    // This is a simple approach; for complex scripts, you might want to use a proper SQL parser
    const statements = sqlScript
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    // Execute each statement
    for (const statement of statements) {
      try {
        await pool.query(statement);
        console.log('✅ Executed:', statement.substring(0, 60) + '...');
      } catch (err) {
        // Ignore "extension already exists" errors
        if (err.message.includes('already exists')) {
          console.log('⚠️  Skipped (already exists):', statement.substring(0, 60) + '...');
        } else if (err.message.includes('Relation') && err.message.includes('already exists')) {
          console.log('⚠️  Skipped (table already exists):', statement.substring(0, 60) + '...');
        } else {
          throw err;
        }
      }
    }
    
    console.log('\n🎉 Database initialization completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Rename .env.example to .env and update with your settings');
    console.log('2. Run: npm run dev');
    console.log('3. Test the API using Postman or curl\n');
    
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close the pool to allow the script to exit
    await pool.end();
  }
};

// Run initialization if this script is executed directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };
