import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import logger from '../utils/logger.js';
import { jwtConfig } from '../config/jwt.js';
import { USER_ROLE_ENUM } from '../utils/constants.js';

class AuthService {
  /**
   * Registers a new user.
   * @param {object} userData - User registration data.
   * @returns {object} The created user (excluding password).
   */
  async register(userData) {
    const { email, password, firstName, lastName, role, phone, institute } = userData;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const error = new Error('User with this email already exists.');
      error.statusCode = 409; // Conflict
      throw error;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: role || USER_ROLE_ENUM.USER,
        phone,
        institute,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        institute: true,
        createdAt: true,
      },
    });

    logger.info(`New user registered: ${email}`);
    return user;
  }

  /**
   * Logs in a user.
   * @param {string} email - User's email.
   * @param {string} password - User's password.
   * @returns {object} { token, user }
   */
  async login(email, password) {
    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401; // Unauthorized
      throw error;
    }

    if (!user.isActive) {
      const error = new Error('Account is deactivated. Contact administrator.');
      error.statusCode = 403; // Forbidden
      throw error;
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401; // Unauthorized
      throw error;
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, institute: user.institute },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    logger.info(`User logged in: ${email}`);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        institute: user.institute,
      },
    };
  }

  /**
   * Gets a user's profile.
   * @param {string} userId - The ID of the user.
   * @returns {object} The user profile.
   */
  async getProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        institute: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }
    return user;
  }

  /**
   * Updates a user's profile.
   * @param {string} userId - The ID of the user.
   * @param {object} updateData - Data to update (firstName, lastName, phone).
   * @returns {object} The updated user profile.
   */
  async updateProfile(userId, updateData) {
    const { firstName, lastName, phone } = updateData;
    const user = await prisma.user.update({
      where: { id: userId },
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
    return user;
  }

  /**
   * Changes a user's password.
   * @param {string} userId - The ID of the user.
   * @param {string} currentPassword - The user's current password.
   * @param {string} newPassword - The user's new password.
   */
  async changePassword(userId, currentPassword, newPassword) {
    // Get user with password
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      const error = new Error('Current password is incorrect.');
      error.statusCode = 401;
      throw error;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    logger.info(`Password changed: ${user.email}`);
  }
}

export default new AuthService();