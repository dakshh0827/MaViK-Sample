import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';
dotenv.config();

// Create transporter only if credentials are provided
let transporter = null;

if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  const smtpConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Additional options for better compatibility
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false,
    },
    debug: process.env.NODE_ENV === 'development', // Enable debug in development
    logger: process.env.NODE_ENV === 'development', // Enable logging in development
  };

  transporter = nodemailer.createTransport(smtpConfig);

  // Verify connection (non-blocking)
  transporter.verify((error, success) => {
    if (error) {
      logger.error('⚠️  Email transporter error:', error.message || error);
      logger.warn('📧 Email functionality will be disabled. Please check your SMTP settings.');
      logger.warn(`   Host: ${smtpConfig.host}, Port: ${smtpConfig.port}, User: ${smtpConfig.auth.user}`);
      // Set transporter to null if verification fails
      transporter = null;
    } else {
      logger.info('✅ Email server is ready to send messages');
      logger.info(`   Connected to: ${smtpConfig.host}:${smtpConfig.port}`);
    }
  });
} else {
  logger.warn('⚠️  SMTP credentials not configured. Email functionality will be disabled.');
  logger.warn('📧 To enable emails, add SMTP_USER and SMTP_PASS to your .env file.');
}

export default transporter;