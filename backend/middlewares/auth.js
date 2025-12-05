/*
 * =====================================================
 * backend/middlewares/auth.js (FIXED - Database Fetch)
 * =====================================================
 */
import jwt from "jsonwebtoken";
import prisma from "../config/database.js";
import logger from "../utils/logger.js";

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. No token provided.",
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Token is empty.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // CRITICAL FIX: Fetch fresh user data from database instead of relying on token
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId || decoded.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        department: true,
        instituteId: true,  // This is the string field (e.g., "ITI_PUSA")
        labId: true,
        isActive: true,
      },
    });

    // Check if user exists and is active
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found. Please login again.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account has been deactivated.",
      });
    }

    // Set req.user with fresh database data
    req.user = {
      id: user.id,
      userId: user.id, // For backward compatibility
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      institute: user.instituteId,  // ← Use instituteId (string) as institute
      instituteId: user.instituteId, // Also provide instituteId
      department: user.department,
      labId: user.labId,
    };

    // Debug logging
    console.log("✅ Auth Middleware - User authenticated:", {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      institute: req.user.institute,
      department: req.user.department,
      labId: req.user.labId,
    });

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please refresh your session.",
        code: "TOKEN_EXPIRED",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token. Please login again.",
        code: "INVALID_TOKEN",
      });
    }

    logger.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication failed.",
    });
  }
};

export default authMiddleware;