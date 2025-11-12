import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import logger from '../utils/logger.js';
import { USER_ROLE_ENUM } from '../utils/constants.js';

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class UserController {
  /**
   * Gets a paginated list of all users.
   */
  getAllUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, role, institute, search } = req.query;
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
          labId: true,
          lab: { select: { name: true } },
          isActive: true,
          createdAt: true,
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  /**
   * Gets all users for a specific institute (for Policy Makers).
   */
  getUsersByInstitute = asyncHandler(async (req, res) => {
    const { institute } = req.params;
    const { page = 1, limit = 50, role } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      institute: institute,
      ...(role && { role }), // Filter by role (LAB_TECHNICIAN or TRAINER)
    };
    
    // If filtering for trainers, we should look by lab institute
    if (role === USER_ROLE_ENUM.TRAINER) {
        delete where.institute;
        where.lab = { institute: institute };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          phone: true,
          isActive: true,
          createdAt: true,
          lab: { select: { id: true, name: true } },
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { role: 'asc' },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  /**
   * Gets a single user by their ID.
   */
  getUserById = asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        institute: true,
        labId: true,
        lab: { select: { name: true } },
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, data: user });
  });

  /**
   * Creates a new user (admin action).
   */
  createUser = asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName, role, phone, institute, labId } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists.',
      });
    }

    // --- NEW: Lab ID Translation ---
    let labInternalId = null;
    if (role === USER_ROLE_ENUM.TRAINER) {
      if (!labId) {
        return res.status(400).json({ success: false, message: 'labId is required for Trainers.' });
      }
      const lab = await prisma.lab.findUnique({ where: { labId: labId } }); // Find lab by PUBLIC ID
      if (!lab) {
        return res.status(400).json({ success: false, message: 'Invalid Lab ID provided.' });
      }
      labInternalId = lab.id; // Get the internal ObjectId for the relation
    }
    // --- END NEW ---

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
        institute: role === USER_ROLE_ENUM.LAB_TECHNICIAN ? institute : null,
        labId: labInternalId, // Use the translated internal ID
        emailVerified: true, // Admin-created users are pre-verified
        authProvider: AUTH_PROVIDER_ENUM.CREDENTIAL,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        institute: true,
        labId: true,
        createdAt: true,
      },
    });

    logger.info(`New user created by ${req.user.email}: ${email}`);
    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data: user,
    });
  });

  /**
   * Updates an existing user (admin action).
   */
  updateUser = asyncHandler(async (req, res) => {
    const { email, firstName, lastName, role, phone, institute, labId, isActive } = req.body;

    // --- NEW: Lab ID Translation ---
    let labInternalId = undefined;
    if (role === USER_ROLE_ENUM.TRAINER && labId) {
      const lab = await prisma.lab.findUnique({ where: { labId: labId } }); // Find lab by PUBLIC ID
      if (!lab) {
        return res.status(400).json({ success: false, message: 'Invalid Lab ID provided.' });
      }
      labInternalId = lab.id; // Get the internal ObjectId for the relation
    }
    // --- END NEW ---

    const dataToUpdate = {
      email,
      firstName,
      lastName,
      role,
      phone,
      institute: role === USER_ROLE_ENUM.LAB_TECHNICIAN ? institute : null,
      labId: role === USER_ROLE_ENUM.TRAINER ? labInternalId : null, // Use translated ID or nullify
      isActive,
    };
    
    // If role is not being changed, don't nullify other fields
    if (!role) {
        delete dataToUpdate.institute;
        delete dataToUpdate.labId;
    }

    // Remove undefined fields
    Object.keys(dataToUpdate).forEach(
      (key) => dataToUpdate[key] === undefined && delete dataToUpdate[key]
    );

    try {
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: dataToUpdate,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          institute: true,
          labId: true,
          isActive: true,
        },
      });
      logger.info(`User updated by ${req.user.email}: ${user.email}`);
      res.json({
        success: true,
        message: 'User updated successfully.',
        data: user,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({ success: false, message: 'Email already in use.' });
      }
      throw error;
    }
  });

  /**
   * Activates or deactivates a user.
   */
  setUserStatus = asyncHandler(async (req, res) => {
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive must be a boolean.' });
    }

    if (req.params.id === req.user.userId && !isActive) {
      return res.status(403).json({ success: false, message: 'You cannot deactivate your own account.' });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive },
      select: { id: true, email: true, isActive: true },
    });

    logger.info(`User status changed by ${req.user.email} for ${user.email}: ${user.isActive}`);
    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'}.`,
      data: user,
    });
  });
}

export default new UserController();