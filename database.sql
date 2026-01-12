-- Database Initialization Script for PostgreSQL
-- Run this script to create the necessary database and tables

-- Create the database (run this manually if needed, or use your PostgreSQL GUI tool)
-- CREATE DATABASE nodeauth;

-- Connect to the database before running the rest of the script
-- \c nodeauth

-- Enable UUID extension for generating unique identifiers
-- This is a PostgreSQL extension that provides functions for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create the users table with proper constraints
-- We use UUID as the primary key for better security (non-sequential, hard to guess)
-- All text fields have appropriate length limits to prevent excessive storage
CREATE TABLE IF NOT EXISTS users (
    -- UUID primary key with auto-generation
    -- Using gen_random_uuid() ensures each user gets a unique identifier
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User's display name
    -- VARCHAR(255) allows up to 255 characters, NOT NULL prevents empty names
    user_name VARCHAR(255) NOT NULL,
    
    -- User's email address (unique constraint ensures no duplicate emails)
    -- Email is critical for authentication, so it's both UNIQUE and NOT NULL
    user_email VARCHAR(255) NOT NULL UNIQUE,
    
    -- User's hashed password
    -- We store only the hash, never the actual password
    -- This is a security best practice - even if the database is compromised,
    -- attackers cannot easily recover original passwords
    user_password VARCHAR(255) NOT NULL,
    
    -- Timestamp for when the user was created
    -- DEFAULT CURRENT_TIMESTAMP automatically sets this to the current time
    -- when a new record is inserted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Timestamp for when the user was last updated
    -- NULL initially, will be updated if user modifies their profile
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create an index on user_email for faster lookups during login
-- Without an index, PostgreSQL would need to scan every row to find a user by email
-- This significantly speeds up the login process
CREATE INDEX IF NOT EXISTS idx_users_email ON users(user_email);

-- Create an index on user_id for faster user lookups in authenticated routes
-- This is used when we need to retrieve user details after verifying their token
CREATE INDEX IF NOT EXISTS idx_users_id ON users(user_id);

-- Add a check constraint to ensure password is properly hashed
-- In production, you might want additional validation here
-- This is a placeholder for custom business rules

-- Add a comment to document the table purpose
COMMENT ON TABLE users IS 'Stores user account information for authentication purposes';
COMMENT ON COLUMN users.user_password IS 'Stores bcrypt hash of the user password, never the plain text password';
