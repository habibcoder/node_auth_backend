/**
 * Email Service
 * 
 * This module handles sending transactional emails using Nodemailer.
 * It supports both development (Ethereal) and production (SMTP) modes.
 * 
 * Key concepts for beginners:
 * - SMTP: Simple Mail Transfer Protocol, the standard for sending emails
 * - Nodemailer: A popular Node.js library for sending emails
 * - Ethereal: A fake SMTP service for testing (emails aren't really sent)
 * - HTML Templates: Professional-looking email content with formatting
 * 
 * Why use a separate email service?
 * - Separation of concerns: Email logic is isolated from business logic
 * - Testability: Use Ethereal in development without real SMTP credentials
 * - Maintainability: Easy to switch email providers or add templates
 * - Reliability: Nodemailer handles connection pooling and retries
 */

const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

/**
 * Create email transporter
 * 
 * A transporter is an object that can send emails.
 * In development, we create a fake Ethereal account automatically.
 * In production, we use the configured SMTP credentials.
 * 
 * Why use Ethereal for development?
 * - No need to set up a real email account
 * - Emails are captured and viewable via a URL
 * - Perfect for testing and development without spamming real addresses
 */

const createTransporter = async () => {
  const hasSmtpConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  // Use Ethereal if explicitly enabled and in development
  if (process.env.USE_ETHEREAL === 'true' && process.env.NODE_ENV === 'development') {
    console.log('📧 Using Ethereal test account for development...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log(`   Email: ${testAccount.user}`);
      console.log(`   Password: ${testAccount.pass}`);
      console.log('🔗 Inbox URL: https://ethereal.email/login');
      
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    } catch (err) {
      console.error('❌ Failed to create Ethereal account:', err);
      return createLoggerTransporter();
    }
  }

  // Use real SMTP if configured
  if (hasSmtpConfig) {
    console.log('📧 Using real SMTP server...');
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_PORT == 465, // SSL for port 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      pool: true,
      rateDelta: 2000,
      rateLimit: 5,
      maxConnections: 5,
      maxMessages: 100
    });
  }

  // 🚨 Production safety
  if (process.env.NODE_ENV === 'production' && !hasSmtpConfig) {
    throw new Error('❌ No SMTP configuration found in production');
  }

  // Fallback: Logger only
  console.log('📧 No email service configured. Using logger fallback.');
  return createLoggerTransporter();
};

/**
 * Create a logger-only transporter (fallback)
 * This logs emails to console instead of sending them
 * Useful when email sending fails or isn't configured
 */
const createLoggerTransporter = () => {
  return {
    sendMail: async (mailOptions) => {
      console.log('\n========== EMAIL WOULD BE SENT ==========');
      console.log(`To: ${mailOptions.to}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log(`HTML Length: ${mailOptions.html ? mailOptions.html.length : 0} characters`);
      console.log('==========================================\n');
      
      // Return a fake message ID for compatibility
      return {
        messageId: `logger-${Date.now()}@localhost`,
        envelope: {
          from: mailOptions.from,
          to: mailOptions.to
        }
      };
    }
  };
};

/**
 * Generate a secure verification token
 * 
 * Why use crypto.randomBytes instead of Math.random?
 * - cryptographically secure (unpredictable)
 * - Suitable for security-sensitive tokens
 * - Math.random() is not cryptographically secure
 * 
 * @param {number} bytes - Number of bytes for the token (default 32)
 * @returns {string} Hex-encoded random token
 */
const generateVerificationToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Generate a secure password reset token
 * 
 * Password reset tokens should be:
 * - Cryptographically random (unpredictable)
 * - Sufficiently long (32 bytes = 64 hex chars is standard)
 * - Time-limited (expires after 1 hour)
 * 
 * @param {number} bytes - Number of bytes for the token
 * @returns {string} Hex-encoded random token
 */
const generateResetToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Email templates
 * 
 * These are simple HTML templates for transactional emails.
 * In production, you might want to use a template engine like Handlebars
 * or a service like SendGrid's dynamic templates.
 */

// Base HTML template with consistent styling
const getBaseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background-color: #f9f9f9;
      border-radius: 8px;
      padding: 30px;
    }
    .logo {
      text-align: center;
      margin-bottom: 20px;
    }
    .logo h1 {
      color: #2563eb;
      margin: 0;
    }
    .button {
      display: inline-block;
      background-color: #2563eb;
      color: white;
      text-decoration: none;
      padding: 12px 30px;
      border-radius: 6px;
      margin: 20px 0;
    }
    .button:hover {
      background-color: #1d4ed8;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
      font-size: 12px;
      color: #666;
    }
    .warning {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 10px 15px;
      margin: 15px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>🔐 Node Auth</h1>
    </div>
    ${content}
    <div class="footer">
      <p>If you didn't request this email, please ignore it.</p>
      <p>This is an automated message from Node Auth Backend.</p>
    </div>
  </div>
</body>
</html>
`;

// Email verification template
const getVerificationEmailTemplate = (name, verificationLink) => {
  return getBaseTemplate(`
    <h2>Welcome to Node Auth, ${name}!</h2>
    <p>Thank you for registering. Please verify your email address to activate your account.</p>
    <p style="text-align: center;">
      <a href="${verificationLink}" class="button">Verify Email Address</a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #666; font-size: 12px;">${verificationLink}</p>
    <div class="warning">
      <strong>⚠️ Important:</strong> This verification link will expire in 24 hours for security purposes.
    </div>
    <p>If you didn't create an account with us, please ignore this email.</p>
  `);
};

// Password reset template
const getResetPasswordEmailTemplate = (name, resetLink) => {
  return getBaseTemplate(`
    <h2>Password Reset Request</h2>
    <p>Hello ${name},</p>
    <p>We received a request to reset your password. Click the button below to create a new password.</p>
    <p style="text-align: center;">
      <a href="${resetLink}" class="button">Reset Password</a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #666; font-size: 12px;">${resetLink}</p>
    <div class="warning">
      <strong>⚠️ Security Notice:</strong> This password reset link will expire in 1 hour for your protection.
      If you didn't request this password reset, please ignore this email or contact support if you're concerned.
    </div>
    <p><strong>Note:</strong> If you requested this reset, your old password will continue to work until you set a new one.</p>
  `);
};

// Password changed confirmation template
const getPasswordChangedTemplate = (name) => {
  return getBaseTemplate(`
    <h2>Password Changed Successfully</h2>
    <p>Hello ${name},</p>
    <p>Your password has been changed successfully. If you made this change, you can ignore this email.</p>
    <div class="warning">
      <strong>⚠️ Didn't make this change?</strong> If you didn't change your password, please contact support immediately.
      Your account may have been compromised.
    </div>
  `);
};

// Email changed confirmation template
const getEmailChangedTemplate = (name, newEmail) => {
  return getBaseTemplate(`
    <h2>Email Address Changed</h2>
    <p>Hello ${name},</p>
    <p>Your email address has been changed to: <strong>${newEmail}</strong></p>
    <p>If you made this change, you should receive a new verification email at your new address.</p>
    <div class="warning">
      <strong>⚠️ Didn't make this change?</strong> If you didn't change your email, please contact support immediately.
    </div>
  `);
};

/**
 * Send an email
 * 
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @returns {Promise<Object>} Send result with preview URL (if available)
 */
const sendEmail = async ({ to, subject, html }) => {
  try {
    const transporter = await createTransporter();
    
    // Ensure we have a valid recipient
    if (!to) {
      throw new Error('Email recipient (to) is required');
    }
    
    // Email options
    const mailOptions = {
      from: `"Node Auth" <${process.env.EMAIL_FROM || 'noreply@yourdomain.com'}>`,
      to,
      subject,
      html
    };
    
    // Send the email
    const info = await transporter.sendMail(mailOptions);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('🔗 Ethereal Preview:', previewUrl);
    }
    
    // Log the result
    if (process.env.NODE_ENV === 'development') {
      console.log('\n📧 Email sent successfully!');
      
      // For Ethereal, show the preview URL
      if (info.messageId && info.messageId.includes('ethereal')) {
        console.log(`🔗 Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      } else {
        console.log(`📬 Message ID: ${info.messageId}`);
      }
    }
    
    return {
      success: true,
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info) // Only works for Ethereal
    };
    
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    
    // Don't throw in development to avoid breaking the flow
    // Just log and continue
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 (Email sending failed in development mode - continuing)');
      return {
        success: false,
        error: error.message,
        previewUrl: null
      };
    }
    
    throw error;
  }
};

/**
 * Send email verification email
 * 
 * @param {string} email - Recipient email address
 * @param {string} name - Recipient name
 * @param {string} token - Verification token
 * @returns {Promise<Object>} Send result
 */
const sendVerificationEmail = async (email, name, token) => {
  // Generate the verification link
  // In a real app, this would point to your frontend
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const verificationLink = `${clientUrl}/verify-email?token=${token}`;
  
  const html = getVerificationEmailTemplate(name, verificationLink);
  
  return sendEmail({
    to: email,
    subject: 'Verify Your Email Address - Node Auth',
    html
  });
};

/**
 * Send password reset email
 * 
 * @param {string} email - Recipient email address
 * @param {string} name - Recipient name
 * @param {string} token - Password reset token
 * @returns {Promise<Object>} Send result
 */
const sendPasswordResetEmail = async (email, name, token) => {
  // Generate the reset link
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const resetLink = `${clientUrl}/reset-password?token=${token}`;
  
  const html = getResetPasswordEmailTemplate(name, resetLink);
  
  return sendEmail({
    to: email,
    subject: 'Password Reset Request - Node Auth',
    html
  });
};

/**
 * Send password change confirmation email
 * 
 * @param {string} email - Recipient email address
 * @param {string} name - Recipient name
 * @returns {Promise<Object>} Send result
 */
const sendPasswordChangeConfirmationEmail = async (email, name) => {
  const html = getPasswordChangedTemplate(name);
  
  return sendEmail({
    to: email,
    subject: 'Your Password Has Been Changed - Node Auth',
    html
  });
};

/**
 * Send email change confirmation email
 * 
 * @param {string} email - New email address
 * @param {string} name - Recipient name
 * @returns {Promise<Object>} Send result
 */
const sendEmailChangeConfirmationEmail = async (email, name) => {
  const html = getEmailChangedTemplate(name, email);
  
  return sendEmail({
    to: email,
    subject: 'Your Email Has Been Changed - Node Auth',
    html
  });
};

module.exports = {
  createTransporter,
  generateVerificationToken,
  generateResetToken,
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangeConfirmationEmail,
  sendEmailChangeConfirmationEmail
};
