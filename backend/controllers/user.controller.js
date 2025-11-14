import bcrypt from "bcryptjs";
import prisma from "../config/database.js";
import logger from "../utils/logger.js";
import { USER_ROLE_ENUM, AUTH_PROVIDER_ENUM } from "../utils/constants.js";

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class UserController {
  getAllUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, role, instituteId, search } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      ...(role && { role }),
      ...(instituteId && { instituteId }),
      ...(search && {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
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
          instituteId: true,
          institute: {
            select: {
              instituteId: true,
              name: true,
            },
          },
          department: true,
          labId: true,
          lab: { select: { labId: true, name: true } },
          isActive: true,
          createdAt: true,
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
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

  getUsersByInstitute = asyncHandler(async (req, res) => {
    const { instituteId } = req.params;
    const { page = 1, limit = 50, role } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      instituteId: instituteId,
      ...(role && { role }),
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
          phone: true,
          department: true,
          isActive: true,
          createdAt: true,
          lab: { select: { id: true, labId: true, name: true } },
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { role: "asc" },
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
        instituteId: true,
        institute: {
          select: {
            instituteId: true,
            name: true,
          },
        },
        department: true,
        labId: true,
        lab: { select: { labId: true, name: true } },
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }
    res.json({ success: true, data: user });
  });

  createUser = asyncHandler(async (req, res) => {
    const {
      email,
      password,
      firstName,
      lastName,
      role,
      phone,
      instituteId,
      department,
      labId,
    } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists.",
      });
    }

    // Lab ID translation
    let labInternalId = null;
    if (role === USER_ROLE_ENUM.TRAINER || role === USER_ROLE_ENUM.LAB_MANAGER) {
      if (!labId) {
        return res
          .status(400)
          .json({ success: false, message: "labId is required for this role." });
      }
      const lab = await prisma.lab.findUnique({ where: { labId: labId } });
      if (!lab) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid Lab ID provided." });
      }
      
      // Validation: Check if lab matches institute and department
      if (lab.instituteId !== instituteId || lab.department !== department) {
         return res
          .status(400)
          .json({ success: false, message: "Lab ID does not match Institute/Department." });
      }
      labInternalId = lab.id;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
        phone,
        department: (role === USER_ROLE_ENUM.LAB_MANAGER || role === USER_ROLE_ENUM.TRAINER) ? department : null,
        instituteId: (role === USER_ROLE_ENUM.LAB_MANAGER || role === USER_ROLE_ENUM.TRAINER) ? instituteId : null,
        labId: labInternalId,
        emailVerified: true,
        authProvider: AUTH_PROVIDER_ENUM.CREDENTIAL,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        instituteId: true,
        institute: {
          select: {
            instituteId: true,
            name: true,
          },
        },
        department: true,
        labId: true,
        createdAt: true,
      },
    });

    logger.info(`New user created by ${req.user.email}: ${email}`);
    res.status(201).json({
      success: true,
      message: "User created successfully.",
      data: user,
    });
  });

  updateUser = asyncHandler(async (req, res) => {
    const {
      email,
      firstName,
      lastName,
      role,
      phone,
      instituteId,
      department,
      labId,
      isActive,
    } = req.body;

    // Lab ID translation
    let labInternalId = undefined;
    if (role && (role === USER_ROLE_ENUM.TRAINER || role === USER_ROLE_ENUM.LAB_MANAGER)) {
      if (labId) {
        const lab = await prisma.lab.findUnique({ where: { labId: labId } });
        if (!lab) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid Lab ID provided." });
        }
        // Validation
        if (lab.instituteId !== instituteId || lab.department !== department) {
           return res
            .status(400)
            .json({ success: false, message: "Lab ID does not match Institute/Department." });
        }
        labInternalId = lab.id;
      }
    }

    const dataToUpdate = {
      email,
      firstName,
      lastName,
      role,
      phone,
      department: (role === USER_ROLE_ENUM.LAB_MANAGER || role === USER_ROLE_ENUM.TRAINER) ? department : null,
      instituteId: (role === USER_ROLE_ENUM.LAB_MANAGER || role === USER_ROLE_ENUM.TRAINER) ? instituteId : null,
      labId: labInternalId !== undefined ? labInternalId : undefined,
      isActive,
    };

    // Remove undefined values
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
          instituteId: true,
          institute: {
            select: {
              instituteId: true,
              name: true,
            },
          },
          department: true,
          labId: true,
          isActive: true,
        },
      });
      logger.info(`User updated by ${req.user.email}: ${user.email}`);
      res.json({
        success: true,
        message: "User updated successfully.",
        data: user,
      });
    } catch (error) {
      if (error.code === "P2002") {
        return res
          .status(409)
          .json({ success: false, message: "Email already in use." });
      }
      throw error;
    }
  });

  setUserStatus = asyncHandler(async (req, res) => {
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res
        .status(400)
        .json({ success: false, message: "isActive must be a boolean." });
    }

    if (req.params.id === req.user.id && !isActive) {
      return res.status(403).json({
        success: false,
        message: "You cannot deactivate your own account.",
      });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive },
      select: { id: true, email: true, isActive: true },
    });

    logger.info(
      `User status changed by ${req.user.email} for ${user.email}: ${user.isActive}`
    );
    res.json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"}.`,
      data: user,
    });
  });
}

export default new UserController();