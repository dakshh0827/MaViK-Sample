import { USER_ROLE_ENUM } from "../utils/constants.js";

/**
 * Role-Based Access Control Middleware
 *
 * Roles:
 * - POLICY_MAKER: Full access, can manage labs
 * - LAB_MANAGER: Department/Institute-level access, cannot manage labs
 * - TRAINER: Lab-level access
 */

const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
    }

    next();
  };
};

// Predefined role checks
const isPolicyMaker = checkRole(USER_ROLE_ENUM.POLICY_MAKER);
const isLabManager = checkRole(USER_ROLE_ENUM.LAB_MANAGER);
const isLabManagerOrAbove = checkRole(
  USER_ROLE_ENUM.POLICY_MAKER,
  USER_ROLE_ENUM.LAB_MANAGER
);
const isAuthenticated = checkRole(
  USER_ROLE_ENUM.POLICY_MAKER,
  USER_ROLE_ENUM.LAB_MANAGER,
  USER_ROLE_ENUM.TRAINER
);

// Permission-based middleware
const can = {
  // Equipment permissions
  manageEquipment: isLabManagerOrAbove,
  viewEquipment: isAuthenticated,

  // Maintenance permissions
  manageMaintenance: isLabManagerOrAbove,
  viewMaintenance: isAuthenticated,

  // Analytics permissions
  viewDetailedAnalytics: isAuthenticated,
  viewBasicAnalytics: isAuthenticated,

  // Report permissions
  generateReports: isLabManagerOrAbove,
  viewReports: isAuthenticated,

  // Alert permissions
  manageAlerts: isLabManagerOrAbove,
  viewAlerts: isAuthenticated,

  // User management
  manageUsers: isPolicyMaker,

  // Lab management - ONLY POLICY_MAKER can manage labs
  manageLabs: isPolicyMaker,
  viewLabs: isLabManagerOrAbove,

  // Institute management - ONLY POLICY_MAKER
  manageInstitutes: isPolicyMaker,

  // System configuration
  manageSystem: isPolicyMaker,
};

/**
 * Creates a Prisma 'where' filter based on the user's role to restrict data access.
 */
const filterDataByRole = (req) => {
  const { role, instituteId, department, labId } = req.user;

  switch (role) {
    /**
     * POLICY_MAKER can see everything across all institutes
     */
    case USER_ROLE_ENUM.POLICY_MAKER:
      return {};

    /**
     * LAB_MANAGER can see everything within their department and institute
     * They manage multiple labs under their department
     */
    case USER_ROLE_ENUM.LAB_MANAGER:
      if (!instituteId || !department) {
        return { id: null }; // Deny access if not properly configured
      }
      return {
        lab: {
          instituteId: instituteId,
          department: department,
        },
      };

    /**
     * TRAINER can see everything within their specific lab only
     */
    case USER_ROLE_ENUM.TRAINER:
      if (!labId) {
        return { id: null }; // Deny access if lab is not set
      }
      return {
        labId: labId,
      };

    /**
     * Default case: deny access
     */
    default:
      return { id: null };
  }
};

/**
 * Filter for Lab queries based on user role
 */
const filterLabsByRole = (req) => {
  const { role, instituteId, department, labId } = req.user;

  switch (role) {
    case USER_ROLE_ENUM.POLICY_MAKER:
      return {}; // Can see all labs

    case USER_ROLE_ENUM.LAB_MANAGER:
      if (!instituteId || !department) {
        return { id: null };
      }
      return {
        instituteId: instituteId,
        department: department,
      };

    case USER_ROLE_ENUM.TRAINER:
      // Trainers should only see their own lab
      if (!labId) {
        return { id: null };
      }
      return {
        id: labId,
      };

    default:
      return { id: null };
  }
};

export {
  checkRole,
  isPolicyMaker,
  isLabManager,
  isLabManagerOrAbove,
  isAuthenticated,
  can,
  filterDataByRole,
  filterLabsByRole,
};