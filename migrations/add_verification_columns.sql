-- Migration Script: Add Email Verification and Password Reset Columns
-- Run this script to update an existing database with the new columns
-- 
-- This migration adds columns for:
-- - Email verification status and tokens
-- - Password reset tokens and expiration
-- - Login attempt tracking for security

-- IMPORTANT: Before running, make sure you have a backup of your database

-- Connect to the database first:
-- \c nodeauth

-- Add is_verified column (default false for existing users)
-- This tracks whether a user has confirmed their email address
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Add verification token column
-- Stores the secure token sent to user's email for verification
-- VARCHAR(255) matches the length of other token columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);

-- Add verification token expiration
-- When this timestamp passes, the verification token is no longer valid
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP;

-- Add password reset token column
-- Stores the secure token sent to user's email for password reset
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255);

-- Add password reset token expiration
-- Password reset tokens should expire quickly (e.g., 1 hour) for security
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP;

-- Add login attempt tracking columns
-- These help prevent brute force attacks by tracking failed login attempts
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMP;

-- Add indexes for the new columns to ensure fast lookups
-- These indexes are crucial for performance when searching by token or email

-- Index for email verification lookups
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);

-- Index for password reset lookups
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_password_token);

-- Index for email + verified status (used in auth middleware)
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(user_email, is_verified);

-- Add comments to document the new columns
COMMENT ON COLUMN users.is_verified IS 'Whether the user has verified their email address';
COMMENT ON COLUMN users.verification_token IS 'Token sent to user email for email verification';
COMMENT ON COLUMN users.verification_token_expires IS 'Expiration time for the verification token';
COMMENT ON COLUMN users.reset_password_token IS 'Token sent to user email for password reset';
COMMENT ON COLUMN users.reset_password_expires IS 'Expiration time for the password reset token';
COMMENT ON COLUMN users.login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN users.lockout_until IS 'Timestamp when the account lockout ends';

-- Verify the new structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
