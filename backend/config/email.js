import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';
dotenv.config();

// Create transporter only if credentials are provided
let transporter = null;

if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Verify connection (non-blocking)
  transporter.verify((error, success) => {
    if (error) {
      logger.error('⚠️  Email transporter error:', error.message);
      logger.warn('📧 Email functionality will be disabled. Please configure SMTP settings in .env file.');
    } else {
      logger.info('✅ Email server is ready to send messages');
    }
  });
} else {
  logger.warn('⚠️  SMTP credentials not configured. Email functionality will be disabled.');
  logger.warn('📧 To enable emails, add SMTP_USER and SMTP_PASS to your .env file.');
}

export default transporter;