import nodemailer from 'nodemailer';
import logger from './logger.js';

// --- CONFIGURE TRANSPORTER ---
// For production, use a real service like SendGrid, Mailgun, or AWS SES.
// For development, use a service like Ethereal or Mailtrap.
// DO NOT hardcode credentials. Use .env variables.

// Example using Ethereal (for testing only)
// let testAccount = await nodemailer.createTestAccount();
// const transporter = nodemailer.createTransport({
//   host: 'smtp.ethereal.email',
//   port: 587,
//   secure: false,
//   auth: {
//     user: testAccount.user,
//     pass: testAccount.pass,
//   },
// });

// Placeholder transporter (doesn't send emails)
const transporter = {
  sendMail: async (mailOptions) => {
    logger.warn('Email service is in development mode. Email not sent.');
    logger.info(`Email Details: To: ${mailOptions.to}, Subject: ${mailOptions.subject}`);
    // const info = await realTransporter.sendMail(mailOptions);
    // logger.info(`Message sent: ${info.messageId}`);
    // logger.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    return { messageId: 'dev-mode-placeholder' };
  }
};


const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@iot-monitor.com';

class EmailService {
  /**
   * Sends a verification or password reset email.
   * @param {string} to - Recipient email address.
   * @param {string} subject - Email subject.
   * @param {string} html - HTML content of the email.
   */
  async sendMail(to, subject, html) {
    const mailOptions = {
      from: `IoT Monitor <${EMAIL_FROM}>`,
      to: to,
      subject: subject,
      html: html,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      logger.error('Failed to send email:', error);
    }
  }

  /**
   * Sends a password reset link email.
   * @param {string} to - Recipient email.
   * @param {string} token - The password reset token.
   */
  async sendPasswordResetEmail(to, token) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    const subject = 'Your Password Reset Request';
    const html = `
      <p>You requested a password reset for your IoT Monitor account.</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}" target="_blank">Reset Password</a>
      <p>If you did not request this, please ignore this email.</p>
    `;
    await this.sendMail(to, subject, html);
  }

  /**
   * Sends a new user welcome email.
   * @param {string} to - Recipient email.
   * @param {string} firstName - User's first name.
   */
  async sendWelcomeEmail(to, firstName) {
    const subject = 'Welcome to the IoT Monitoring Platform!';
    const html = `
      <p>Hi ${firstName},</p>
      <p>Welcome! Your account has been created successfully.</p>
      <p>You can now log in at: ${process.env.FRONTEND_URL}</p>
    `;
    await this.sendMail(to, subject, html);
  }
}

export default new EmailService();