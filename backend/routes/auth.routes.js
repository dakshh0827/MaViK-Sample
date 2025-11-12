import express from 'express';
import passport from 'passport';
import authController from '../controllers/auth.controller.js';
import authMiddleware from '../middlewares/auth.js';
import {
  registerValidation,
  loginValidation,
  verifyOTPValidation,
  resendOTPValidation,
  changePasswordValidation,
} from '../middlewares/validation.js';
import { authLimiter, otpLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// ===== Credential-based Authentication Routes =====

// Step 1: Register (creates user and sends OTP)
router.post('/register', authLimiter, registerValidation, authController.register);

// Step 2: Verify email with OTP
router.post('/verify-email', otpLimiter, verifyOTPValidation, authController.verifyEmail);

// Resend OTP (fixed method name from resendOTP to resendOtp)
router.post('/resend-otp', otpLimiter, resendOTPValidation, authController.resendOtp);

// Login - supports both direct login and OTP-based login
// Direct login: POST /login with { email, password }
// OTP-based login: POST /login with { email, password, requireOtp: true }
router.post('/login', authLimiter, loginValidation, authController.login);

// Complete login with OTP (for OTP-based login flow)
router.post('/login/verify', otpLimiter, verifyOTPValidation, authController.completeLogin);

// ===== OAuth Routes =====

// Google OAuth
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_auth_failed`,
    session: false 
  }),
  authController.oauthCallback
);

// GitHub OAuth
router.get(
  '/github',
  passport.authenticate('github', { scope: ['user:email'] })
);

router.get(
  '/github/callback',
  passport.authenticate('github', { 
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=github_auth_failed`,
    session: false 
  }),
  authController.oauthCallback
);

// ===== Protected Routes =====

// Get current user profile
router.get('/profile', authMiddleware, authController.getProfile);

// Update profile
router.put('/profile', authMiddleware, authController.updateProfile);

// Change password
router.put(
  '/change-password',
  authMiddleware,
  changePasswordValidation,
  authController.changePassword
);

export default router;