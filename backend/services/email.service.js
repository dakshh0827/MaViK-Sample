import transporter from '../config/email.js';
import logger from '../utils/logger.js';

class EmailService {
  /**
   * Send OTP email
   */
  async sendOTP(email, otp, purpose = 'verification') {
    const subject = purpose === 'login' ? 'Your Login OTP' : 'Verify Your Email';
    const message = purpose === 'login' 
      ? `Your OTP for login is: ${otp}. It will expire in 10 minutes.`
      : `Your OTP for email verification is: ${otp}. It will expire in 10 minutes.`;

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Your App'}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .otp-box { 
                background: #f4f4f4; 
                padding: 20px; 
                text-align: center; 
                font-size: 32px; 
                font-weight: bold;
                letter-spacing: 5px;
                margin: 20px 0;
                border-radius: 5px;
              }
              .footer { margin-top: 30px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>${subject}</h2>
              <p>Hello,</p>
              <p>${message}</p>
              <div class="otp-box">${otp}</div>
              <p>If you didn't request this, please ignore this email.</p>
              <div class="footer">
                <p>This is an automated email, please do not reply.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      logger.info(`OTP email sent to ${email}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`Error sending OTP email to ${email}:`, error);
      throw new Error('Failed to send OTP email');
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email, name) {
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Your App'}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Welcome to Our Platform!',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; }
              .footer { margin-top: 30px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome aboard!</h1>
              </div>
              <div class="content">
                <p>Hello ${name},</p>
                <p>Thank you for registering with us. Your account has been successfully created and verified.</p>
                <p>You can now log in and start using our platform.</p>
              </div>
              <div class="footer">
                <p>This is an automated email, please do not reply.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      logger.info(`Welcome email sent to ${email}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`Error sending welcome email to ${email}:`, error);
      // Don't throw error for welcome email failure
      return { success: false, error: error.message };
    }
  }
}

export default new EmailService();