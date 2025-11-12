import { USER_ROLE_ENUM } from '../utils/constants.js';

/**
 * Role-Based Access Control Middleware
 *
 * Roles:
 * - POLICY_MAKER: Full access.
 * - LAB_TECHNICIAN: Institute-level access.
 * - TRAINER: Lab-level access.
 */

const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
    }

    next();
  };
};

// Predefined role checks
const isPolicyMaker = checkRole(USER_ROLE_ENUM.POLICY_MAKER);
const isLabTechnician = checkRole(USER_ROLE_ENUM.LAB_TECHNICIAN); // --- NEW ---
const isLabTechnicianOrAbove = checkRole(
  USER_ROLE_ENUM.POLICY_MAKER,
  USER_ROLE_ENUM.LAB_TECHNICIAN
);
const isAuthenticated = checkRole(
  USER_ROLE_ENUM.POLICY_MAKER,
  USER_ROLE_ENUM.LAB_TECHNICIAN,
  USER_ROLE_ENUM.TRAINER
);

// Permission-based middleware
const can = {
  // Equipment permissions
  manageEquipment: isLabTechnicianOrAbove,
  viewEquipment: isAuthenticated,

  // Maintenance permissions
  manageMaintenance: isLabTechnicianOrAbove,
  viewMaintenance: isAuthenticated,

  // Analytics permissions
  viewDetailedAnalytics: isAuthenticated,
  viewBasicAnalytics: isAuthenticated,

  // Report permissions
  generateReports: isLabTechnicianOrAbove,
  viewReports: isAuthenticated,

  // Alert permissions
  manageAlerts: isLabTechnicianOrAbove,
  viewAlerts: isAuthenticated,

  // User management
  manageUsers: isPolicyMaker,

  // Lab management
  // --- LOGIC FLIPPED AS REQUESTED ---
  manageLabs: isLabTechnician, // Only Lab Technicians can manage labs
  viewLabs: isLabTechnicianOrAbove, // Policy Makers can still view labs

  // System configuration
  manageSystem: isPolicyMaker,
};

/**
 * Creates a Prisma 'where' filter based on the user's role to restrict data access.
 */
const filterDataByRole = (req) => {
  const { role, institute, labId } = req.user;

  switch (role) {
    /**
     * POLICY_MAKER can see everything.
     */
    case USER_ROLE_ENUM.POLICY_MAKER:
      return {};

    /**
     * LAB_TECHNICIAN can see everything within their institute.
     */
    case USER_ROLE_ENUM.LAB_TECHNICIAN:
      if (!institute) {
        return { id: null }; // Deny access if institute is not set
      }
      return {
        lab: {
          institute: institute,
        },
      };

    /**
     * TRAINER can see everything within their specific lab.
     */
    case USER_ROLE_ENUM.TRAINER:
      if (!labId) {
        return { id: null }; // Deny access if lab is not set
      }
      return {
        labId: labId, // This is the INTERNAL labId
      };

    /**
     * Default case: deny access.
     */
    default:
      return { id: null };
  }
};

export {
  checkRole,
  isPolicyMaker,
  isLabTechnician,
  isLabTechnicianOrAbove,
  isAuthenticated,
  can,
  filterDataByRole,
};