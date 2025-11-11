import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import logger from '../utils/logger.js';

class UserService {
  /**
   * Gets a paginated list of all users.
   * @param {object} queryParams - Page, limit, role, institute, search.
   * @returns {object} { users, pagination }
   */
  async getAllUsers(queryParams) {
    const { page = 1, limit = 20, role, institute, search } = queryParams;
    const skip = (page - 1) * limit;

    const where = {
      ...(role && { role }),
      ...(institute && { institute }),
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          institute: true,
          isActive: true,
          createdAt: true,
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Gets a single user by their ID.
   * @param {string} userId - The ID of the user to retrieve.
   * @returns {object} The user object.
   */
  async getUserById(userId) {
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
   * Creates a new user (admin action).
   * @param {object} userData - Data for the new user.
   * @returns {object} The created user.
   */
  async createUser(userData) {
    const { email, password, firstName, lastName, role, phone, institute } = userData;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const error = new Error('User with this email already exists.');
      error.statusCode = 409;
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
        role,
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

    logger.info(`New user created by admin: ${email}`);
    return user;
  }

  /**
   * Updates an existing user (admin action).
   * @param {string} userId - The ID of the user to update.
   * @param {object} updateData - The data to update.
   * @returns {object} The updated user.
   */
  async updateUser(userId, updateData) {
    const { email, firstName, lastName, role, phone, institute, isActive } = updateData;

    const dataToUpdate = {
      email,
      firstName,
      lastName,
      role,
      phone,
      institute,
      isActive,
    };
    
    // Remove undefined fields
    Object.keys(dataToUpdate).forEach(
      (key) => dataToUpdate[key] === undefined && delete dataToUpdate[key]
    );

    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: dataToUpdate,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          institute: true,
          isActive: true,
        },
      });
      logger.info(`User updated by admin: ${user.email}`);
      return user;
    } catch (error) {
      if (error.code === 'P2002') {
        const err = new Error('Email already in use.');
        err.statusCode = 409;
        throw err;
      }
      throw error;
    }
  }

  /**
   * Activates or deactivates a user.
   * @param {string} userId - The ID of the user.
   * @param {boolean} isActive - The new active status.
   * @param {string} adminUserId - The ID of the admin performing the action.
   * @returns {object} The updated user.
   */
  async setUserStatus(userId, isActive, adminUserId) {
    if (typeof isActive !== 'boolean') {
      const error = new Error('isActive must be a boolean.');
      error.statusCode = 400;
      throw error;
    }

    // Prevent admin from deactivating themselves
    if (userId === adminUserId && !isActive) {
      const error = new Error('You cannot deactivate your own account.');
      error.statusCode = 403;
      throw error;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: { id: true, email: true, isActive: true },
    });

    logger.info(`User status changed by admin ${adminUserId} for ${user.email}: ${user.isActive}`);
    return user;
  }
}

export default new UserService();