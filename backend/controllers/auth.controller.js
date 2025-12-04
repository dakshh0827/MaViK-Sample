import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../config/database.js";
import logger from "../utils/logger.js";
import { jwtConfig } from "../config/jwt.js";
import {
  USER_ROLE_ENUM,
  OTP_PURPOSE_ENUM,
  DEPARTMENT_ENUM,
} from "../utils/constants.js";
import EmailService from "../services/email.service.js";

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const generateOtp = () => crypto.randomInt(100000, 999999).toString();

const generateAccessToken = (user) => {
  const payload = {
    userId: user.id || user.userId,
    email: user.email,
    role: user.role,
    instituteId: user.instituteId,
    department: user.department,
    labId: user.labId,
  };
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  });
};

const generateRefreshToken = (user) => {
  const payload = {
    userId: user.id || user.userId,
  };
  return jwt.sign(payload, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpiresIn,
  });
};

class AuthController {
  register = asyncHandler(async (req, res, next) => {
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

    // FIXED: Validate email format
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: "Valid email is required.",
      });
    }

    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format.",
      });
    }

    // Trim and lowercase the email
    const cleanEmail = email.trim().toLowerCase();

    // Log to verify email is correct
    logger.info(`Registration attempt with email: ${cleanEmail}`);

    // Validate role is a valid UserRole enum value
    const validRoles = Object.values(USER_ROLE_ENUM);
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
      });
    }

    let existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (existingUser) {
      if (existingUser.emailVerified) {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists and is verified. Please login instead.",
        });
      }
      logger.info(`Updating unverified user registration: ${cleanEmail}`);
    }

    // Lab ID translation for Trainers and Lab Managers
    let labInternalId = null;
    if (role === "TRAINER" || role === "LAB_MANAGER") {
      if (!labId) {
        return res.status(400).json({
          success: false,
          message: "labId is required for this role.",
        });
      }

      const lab = await prisma.lab.findFirst({
        where: {
          labId: { equals: labId.trim(), mode: "insensitive" },
          instituteId: instituteId,
          department: department,
        },
      });

      if (!lab) {
        logger.error(
          `Lab not found with matching labId: "${labId}", institute: "${instituteId}", department: "${department}"`
        );
        return res.status(400).json({
          success: false,
          message: `Invalid Lab ID or it does not match the selected Institute/Department.`,
        });
      }

      labInternalId = lab.id;
      logger.info(`Lab found: ${lab.name} (ID: ${lab.id})`);
    }

    // Validate role-specific requirements
    if (role === "LAB_MANAGER" || role === "TRAINER") {
      if (!instituteId || !department) {
        return res.status(400).json({
          success: false,
          message: "Institute and Department are required for this role.",
        });
      }

      const validDepartments = Object.values(DEPARTMENT_ENUM);

      if (!validDepartments.includes(department)) {
        return res.status(400).json({
          success: false,
          message: `Invalid department. Must be one of: ${validDepartments.join(
            ", "
          )}`,
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const baseUserData = {
      email: cleanEmail, // Use cleanEmail instead of email
      password: hashedPassword,
      firstName,
      lastName,
      role: role || "TRAINER",
      phone: phone || null,
      department:
        role === "LAB_MANAGER" || role === "TRAINER" ? department : null,
      instituteId:
        role === "LAB_MANAGER" || role === "TRAINER" ? instituteId : null,
      labId: labInternalId,
      emailVerified: false,
    };

    // Log the data being saved
    logger.info(`Saving user with email: ${baseUserData.email}`);

    let user;
    try {
      if (existingUser) {
        // User exists but is not verified - update their data
        user = await prisma.user.update({
          where: { email: cleanEmail },
          data: baseUserData,
        });
      } else {
        // Create new user
        user = await prisma.user.create({
          data: baseUserData,
        });
      }
      
      // Log saved user to verify email
      logger.info(`User saved successfully with email: ${user.email}`);
    } catch (error) {
      logger.error('Error creating/updating user:', error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred during registration. Please try again.',
      });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.oTP.updateMany({
      where: { email: cleanEmail, purpose: "REGISTRATION", isUsed: false },
      data: { isUsed: true },
    });

    await prisma.oTP.create({
      data: {
        email: cleanEmail,
        otp,
        purpose: "REGISTRATION",
        expiresAt,
      },
    });

    EmailService.sendOTP(cleanEmail, otp, "verification").catch((err) =>
      logger.error("Failed to send OTP email:", err)
    );

    logger.info(`New user registration initiated: ${cleanEmail}. OTP sent.`);
    res.status(201).json({
      success: true,
      message:
        "Registration successful. An OTP has been sent to your email for verification.",
      requiresVerification: true,
      data: {
        email: user.email,
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  });

  verifyEmail = asyncHandler(async (req, res, next) => {
    const { email, otp, purpose = "REGISTRATION" } = req.body;

    const validOtp = await prisma.oTP.findFirst({
      where: {
        email,
        otp,
        purpose,
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!validOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP.",
      });
    }

    await prisma.oTP.update({
      where: { id: validOtp.id },
      data: { isUsed: true },
    });

    const user = await prisma.user.update({
      where: { email },
      data: { emailVerified: true },
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
      },
    });

    EmailService.sendWelcomeEmail(email, user.firstName).catch((err) =>
      logger.error("Failed to send welcome email:", err)
    );

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    logger.info(`Email verified for user: ${email}`);
    res.json({
      success: true,
      message: "Email verified successfully. You are now logged in.",
      data: {
        accessToken,
        user,
      },
    });
  });

  resendOtp = asyncHandler(async (req, res, next) => {
    const { email, purpose = "REGISTRATION" } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (purpose === "REGISTRATION" && user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified.",
      });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.oTP.updateMany({
      where: { email, purpose, isUsed: false },
      data: { isUsed: true },
    });

    await prisma.oTP.create({
      data: { email, otp, purpose, expiresAt },
    });

    const emailPurpose = purpose === "LOGIN" ? "login" : "verification";
    EmailService.sendOTP(email, otp, emailPurpose).catch((err) =>
      logger.error("Failed to send OTP email:", err)
    );

    logger.info(`Resent OTP for: ${email}. Purpose: ${purpose}`);
    res.json({
      success: true,
      message: "A new OTP has been sent to your email.",
    });
  });

  login = asyncHandler(async (req, res, next) => {
    const { email, password, requireOtp = false } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Email not verified. Please check your inbox for an OTP.",
        requiresVerification: true,
        data: { emailVerified: false },
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated. Contact administrator.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (requireOtp) {
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await prisma.oTP.updateMany({
        where: { email, purpose: "LOGIN", isUsed: false },
        data: { isUsed: true },
      });

      await prisma.oTP.create({
        data: { email, otp, purpose: "LOGIN", expiresAt },
      });

      EmailService.sendOTP(email, otp, "login").catch((err) =>
        logger.error("Failed to send OTP email:", err)
      );

      logger.info(`Login OTP sent to: ${email}`);
      return res.json({
        success: true,
        message: "OTP sent to your email. Please verify to complete login.",
        requiresOTP: true,
      });
    }

    const userPayload = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      instituteId: user.instituteId,
      department: user.department,
      labId: user.labId,
    };

    const accessToken = generateAccessToken(userPayload);
    const refreshToken = generateRefreshToken(userPayload);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    logger.info(`User logged in: ${email}`);
    res.json({
      success: true,
      message: "Login successful.",
      data: {
        accessToken,
        user: userPayload,
      },
    });
  });

  completeLogin = asyncHandler(async (req, res, next) => {
    const { email, otp } = req.body;

    const validOtp = await prisma.oTP.findFirst({
      where: {
        email,
        otp,
        purpose: "LOGIN",
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!validOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP.",
      });
    }

    await prisma.oTP.update({
      where: { id: validOtp.id },
      data: { isUsed: true },
    });

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        instituteId: true,
        department: true,
        labId: true,
      },
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    logger.info(`User logged in via OTP: ${email}`);
    res.json({
      success: true,
      message: "Login successful.",
      data: {
        accessToken,
        user,
      },
    });
  });

  getProfile = asyncHandler(async (req, res) => {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
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
        isActive: true,
        emailVerified: true,
        createdAt: true,
        lab: {
          select: {
            labId: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  });

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
        instituteId: true,
        department: true,
        labId: true,
      },
    });

    logger.info(`Profile updated: ${req.user.email}`);
    res.json({
      success: true,
      message: "Profile updated successfully.",
      data: user,
    });
  });

  changePassword = asyncHandler(async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "Cannot change password for this account.",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    logger.info(`Password changed: ${req.user.email}`);
    res.json({
      success: true,
      message: "Password changed successfully.",
    });
  });

  refreshToken = asyncHandler(async (req, res, next) => {
    const token = req.cookies.refreshToken;

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "No refresh token provided." });
    }

    let payload;
    try {
      payload = jwt.verify(token, jwtConfig.refreshSecret);
    } catch (err) {
      logger.warn("Invalid refresh token received:", err.message);
      return res
        .status(403)
        .json({ success: false, message: "Invalid or expired refresh token." });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        instituteId: true,
        department: true,
        labId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res
        .status(403)
        .json({ success: false, message: "User not found or deactivated." });
    }

    const userPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      instituteId: user.instituteId,
      department: user.department,
      labId: user.labId,
    };
    const accessToken = generateAccessToken(userPayload);

    res.json({
      success: true,
      message: "Access token refreshed.",
      data: {
        accessToken,
      },
    });
  });

  logout = asyncHandler(async (req, res, next) => {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    res
      .status(200)
      .json({ success: true, message: "Logged out successfully." });
  });
}

export default new AuthController();