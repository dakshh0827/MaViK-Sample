import express from 'express';
import authController from '../controllers/auth.controller.js';
import authMiddleware from '../middlewares/auth.js';
import {
  registerValidation,
  loginValidation,
  changePasswordValidation,
} from '../middlewares/validation.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Public routes with rate limiting
router.post('/register', authLimiter, registerValidation, authController.register);
router.post('/login', authLimiter, loginValidation, authController.login);

// Protected routes
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.put(
  '/change-password',
  authMiddleware,
  changePasswordValidation,
  authController.changePassword
);

export default router;