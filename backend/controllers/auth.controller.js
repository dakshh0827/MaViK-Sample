import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import logger from '../utils/logger.js';
import { jwtConfig } from '../config/jwt.js';
import { USER_ROLE_ENUM } from '../utils/constants.js';
import otpService from '../services/otp.service.js';
import emailService from '../services/email.service.js';

/**
 * Wraps async functions to catch errors and pass to next middleware.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class AuthController {
  /**
   * Step 1: Register new user (creates unverified user and sends OTP)
   */
  register = asyncHandler(async (req, res, next) => {
    const { email, password, firstName, lastName, role, phone, institute } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      if (existingUser.isEmailVerified) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists.',
        });
      } else {
        // User exists but not verified, resend OTP
        await otpService.createAndSendOTP(email, 'REGISTRATION');
        return res.status(200).json({
          success: true,
          message: 'User already exists but not verified. New OTP sent to email.',
          requiresVerification: true,
        });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create unverified user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: role || USER_ROLE_ENUM.TRAINER,
        phone,
        institute,
        isEmailVerified: false,
        authProvider: 'CREDENTIALS',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        institute: true,
        isEmailVerified: true,
      },
    });

    // Send OTP
    await otpService.createAndSendOTP(email, 'REGISTRATION');

    logger.info(`New user registered (unverified): ${email}`);
    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email with the OTP sent.',
      requiresVerification: true,
      data: user,
    });
  });

  /**
   * Step 2: Verify email with OTP
   */
  verifyEmail = asyncHandler(async (req, res, next) => {
    const { email, otp } = req.body;

    // Verify OTP
    const verificationResult = await otpService.verifyOTP(email, otp, 'REGISTRATION');
    
    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        message: verificationResult.message,
      });
    }

    // Update user as verified
    const user = await prisma.user.update({
      where: { email },
      data: { isEmailVerified: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        institute: true,
      },
    });

    // Send welcome email
    await emailService.sendWelcomeEmail(email, user.firstName);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, institute: user.institute },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    logger.info(`Email verified for user: ${email}`);
    res.json({
      success: true,
      message: 'Email verified successfully.',
      data: {
        token,
        user,
      },
    });
  });

  /**
   * Resend OTP for email verification
   */
  resendOTP = asyncHandler(async (req, res, next) => {
    const { email, purpose = 'REGISTRATION' } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (user.isEmailVerified && purpose === 'REGISTRATION') {
      return res.status(400).json({
        success: false,
        message: 'Email already verified.',
      });
    }

    // Send new OTP
    await otpService.createAndSendOTP(email, purpose);

    res.json({
      success: true,
      message: 'OTP sent successfully.',
    });
  });

  /**
   * Step 1: Initiate login (send OTP for credential-based login)
   */
  initiateLogin = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Check if user is OAuth-only
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'This account uses OAuth. Please login with Google or GitHub.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Contact administrator.',
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email not verified. Please verify your email first.',
        requiresVerification: true,
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Send OTP for login verification
    await otpService.createAndSendOTP(email, 'LOGIN');

    logger.info(`Login OTP sent to: ${email}`);
    res.json({
      success: true,
      message: 'OTP sent to your email. Please verify to complete login.',
      requiresOTP: true,
    });
  });

  /**
   * Step 2: Complete login with OTP
   */
  completeLogin = asyncHandler(async (req, res, next) => {
    const { email, otp } = req.body;

    // Verify OTP
    const verificationResult = await otpService.verifyOTP(email, otp, 'LOGIN');
    
    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        message: verificationResult.message,
      });
    }

    // Get user
    const user = await prisma.user.findUnique({ where: { email } });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, institute: user.institute },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    logger.info(`User logged in: ${email}`);
    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          institute: user.institute,
        },
      },
    });
  });

  /**
   * OAuth callback handler (for both Google and GitHub)
   */
  oauthCallback = asyncHandler(async (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=authentication_failed`);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, institute: user.institute },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    logger.info(`User logged in via OAuth: ${user.email}`);
    
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  });

  /**
   * Get current user profile
   */
  getProfile = asyncHandler(async (req, res, next) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        institute: true,
        isActive: true,
        isEmailVerified: true,
        authProvider: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    
    res.json({
      success: true,
      data: user,
    });
  });

  /**
   * Update profile
   */
  updateProfile = asyncHandler(async (req, res, next) => {
    const { firstName, lastName, phone } = req.body;
    
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone && { phone }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        institute: true,
      },
    });

    logger.info(`Profile updated: ${user.email}`);
    res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: user,
    });
  });

  /**
   * Change password
   */
  changePassword = asyncHandler(async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Check if user has password (not OAuth-only)
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change password for OAuth accounts.',
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    logger.info(`Password changed: ${user.email}`);
    res.json({
      success: true,
      message: 'Password changed successfully.',
    });
  });
}

export default new AuthController();