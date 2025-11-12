import crypto from 'crypto';
import prisma from '../config/database.js';
import emailService from './email.service.js';
import logger from '../utils/logger.js';

class OTPService {
  /**
   * Generate a 6-digit OTP
   */
  generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Create and send OTP for email verification
   */
  async createAndSendOTP(email, purpose = 'REGISTRATION') {
    const otp = this.generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing OTPs for this email and purpose
    await prisma.oTP.deleteMany({
      where: {
        email,
        purpose,
      },
    });

    // Create new OTP
    await prisma.oTP.create({
      data: {
        email,
        otp,
        purpose,
        expiresAt,
      },
    });

    // Send OTP via email
    const emailPurpose = purpose === 'LOGIN' ? 'login' : 'verification';
    await emailService.sendOTP(email, otp, emailPurpose);

    logger.info(`OTP created and sent to ${email} for ${purpose}`);
    return { success: true };
  }

  /**
   * Verify OTP
   */
  async verifyOTP(email, otp, purpose = 'REGISTRATION') {
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        email,
        otp,
        purpose,
        isUsed: false,
        expiresAt: {
          gte: new Date(),
        },
      },
    });

    if (!otpRecord) {
      return { success: false, message: 'Invalid or expired OTP' };
    }

    // Mark OTP as used
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    logger.info(`OTP verified for ${email} (${purpose})`);
    return { success: true };
  }

  /**
   * Clean up expired OTPs (can be run as a cron job)
   */
  async cleanupExpiredOTPs() {
    const deleted = await prisma.oTP.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isUsed: true },
        ],
      },
    });

    logger.info(`Cleaned up ${deleted.count} expired/used OTPs`);
    return deleted.count;
  }
}

export default new OTPService();