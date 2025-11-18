/*
 * =====================================================
 * backend/controllers/breakdown.controller.js
 * =====================================================
 */
import prisma from "../config/database.js";
import logger from "../utils/logger.js";
import { filterDataByRole } from "../middlewares/rbac.js";
import { broadcastNotification, broadcastAlert } from "../config/socketio.js";
import {
  ALERT_TYPE,
  ALERT_SEVERITY,
  NOTIFICATION_TYPE,
  USER_ROLE_ENUM,
  BREAKDOWN_CHECK_DAYS,
} from "../utils/constants.js";

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class BreakdownController {
  /**
   * Check for equipment not operated for 15+ days
   * This runs as a scheduled job
   */
  checkInactiveEquipment = async () => {
    try {
      logger.info("🔍 Running breakdown check for inactive equipment...");

      const fifteenDaysAgo = new Date(
        Date.now() - BREAKDOWN_CHECK_DAYS * 24 * 60 * 60 * 1000
      );

      // Find equipment that hasn't been used in 15+ days and is not already in breakdown
      const inactiveEquipment = await prisma.equipment.findMany({
        where: {
          isActive: true,
          status: {
            lastUsedAt: {
              lte: fifteenDaysAgo,
            },
            status: {
              notIn: ["MAINTENANCE", "FAULTY"],
            },
          },
          // Not already in breakdown list
          breakdownRecords: {
            none: {
              status: {
                in: ["REPORTED", "REORDER_PENDING", "REORDER_APPROVED"],
              },
            },
          },
        },
        include: {
          status: true,
          lab: {
            include: {
              institute: true,
            },
          },
        },
      });

      logger.info(`Found ${inactiveEquipment.length} inactive equipment`);

      // Create alerts for each inactive equipment
      for (const equipment of inactiveEquipment) {
        await this.createBreakdownAlert(equipment);
      }

      return inactiveEquipment;
    } catch (error) {
      logger.error("❌ Error checking inactive equipment:", error);
      throw error;
    }
  };

  /**
   * Create breakdown alert for equipment
   */
  createBreakdownAlert = async (equipment) => {
    try {
      // Find lab managers for this equipment's institute and department
      const labManagers = await prisma.user.findMany({
        where: {
          role: USER_ROLE_ENUM.LAB_MANAGER,
          instituteId: equipment.lab.instituteId,
          department: equipment.lab.department,
          isActive: true,
        },
        select: { id: true },
      });

      if (labManagers.length === 0) {
        logger.warn(
          `No lab managers found for equipment ${equipment.equipmentId}`
        );
        return;
      }

      const daysSinceLastUse = Math.floor(
        (Date.now() - new Date(equipment.status.lastUsedAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      // Create alert with special metadata for breakdown check
      const alert = await prisma.alert.create({
        data: {
          equipmentId: equipment.id,
          type: ALERT_TYPE.EQUIPMENT_BREAKDOWN_CHECK,
          severity: ALERT_SEVERITY.MEDIUM,
          title: `Equipment Inactive: ${equipment.name}`,
          message: `This equipment has not been operated for ${daysSinceLastUse} days. Is it broken down?`,
          notifications: {
            create: labManagers.map((manager) => ({
              userId: manager.id,
              title: `Equipment Breakdown Check Required`,
              message: `${equipment.name} (${equipment.equipmentId}) has been inactive for ${daysSinceLastUse} days. Please verify if it's broken down.`,
              type: NOTIFICATION_TYPE.BREAKDOWN_ALERT,
            })),
          },
        },
        include: {
          notifications: true,
          equipment: {
            select: {
              name: true,
              equipmentId: true,
              lab: { select: { name: true } },
            },
          },
        },
      });

      // Broadcast alert and notifications
      broadcastAlert(alert);
      for (const notification of alert.notifications) {
        broadcastNotification(notification.userId, notification);
      }

      logger.info(
        `✅ Breakdown alert created for equipment ${equipment.equipmentId}`
      );

      return alert;
    } catch (error) {
      logger.error("Error creating breakdown alert:", error);
      throw error;
    }
  };

  /**
   * Get all breakdown equipment for lab manager
   */
  getBreakdownEquipment = asyncHandler(async (req, res) => {
    const { role, instituteId, department } = req.user;

    const where = {};

    if (role === USER_ROLE_ENUM.LAB_MANAGER) {
      where.equipment = {
        lab: {
          instituteId: instituteId,
          department: department,
        },
      };
    }
    // Policy makers can see all

    const breakdownEquipment = await prisma.breakdownEquipment.findMany({
      where,
      include: {
        equipment: {
          include: {
            lab: {
              include: {
                institute: true,
              },
            },
            status: true,
          },
        },
        reportedByUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reorderRequests: {
          include: {
            reviewedByUser: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: {
            requestedAt: "desc",
          },
        },
      },
      orderBy: {
        reportedAt: "desc",
      },
    });

    res.json({
      success: true,
      data: breakdownEquipment,
    });
  });

  /**
   * Respond to breakdown alert (Yes/No)
   */
  respondToBreakdownAlert = asyncHandler(async (req, res) => {
    const { alertId } = req.params;
    const { isBreakdown, reason } = req.body;

    // Validate
    if (typeof isBreakdown !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isBreakdown must be a boolean value",
      });
    }

    // Get alert
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        equipment: {
          include: {
            lab: true,
          },
        },
      },
    });

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found",
      });
    }

    // Check if user has access
    if (
      req.user.role === USER_ROLE_ENUM.LAB_MANAGER &&
      (alert.equipment.lab.instituteId !== req.user.instituteId ||
        alert.equipment.lab.department !== req.user.department)
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this alert",
      });
    }

    // Resolve the alert
    await prisma.alert.update({
      where: { id: alertId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: req.user.email,
      },
    });

    // If breakdown confirmed, add to breakdown list
    if (isBreakdown) {
      const breakdown = await prisma.breakdownEquipment.create({
        data: {
          equipmentId: alert.equipmentId,
          reportedBy: req.user.id,
          reason: reason || "Confirmed via automatic check",
          isAutoDetected: true,
          status: "REPORTED",
        },
        include: {
          equipment: {
            include: {
              lab: true,
            },
          },
        },
      });

      logger.info(
        `Equipment ${alert.equipment.equipmentId} added to breakdown list`
      );

      return res.json({
        success: true,
        message: "Equipment added to breakdown list",
        data: breakdown,
      });
    }

    res.json({
      success: true,
      message: "Alert resolved. Equipment is operational.",
    });
  });

  /**
   * Manually add equipment to breakdown list
   */
  addBreakdownEquipment = asyncHandler(async (req, res) => {
    const { equipmentId, reason } = req.body;

    if (!equipmentId || !reason) {
      return res.status(400).json({
        success: false,
        message: "Equipment ID and reason are required",
      });
    }

    // Get equipment
    const equipment = await prisma.equipment.findFirst({
      where: { equipmentId },
      include: {
        lab: true,
      },
    });

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found",
      });
    }

    // Check access
    const roleFilter = filterDataByRole(req);
    const hasAccess = await prisma.equipment.findFirst({
      where: { id: equipment.id, ...roleFilter },
    });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this equipment",
      });
    }

    // Check if already in breakdown list
    const existing = await prisma.breakdownEquipment.findFirst({
      where: {
        equipmentId: equipment.id,
        status: {
          in: ["REPORTED", "REORDER_PENDING", "REORDER_APPROVED"],
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Equipment is already in breakdown list",
      });
    }

    // Add to breakdown list
    const breakdown = await prisma.breakdownEquipment.create({
      data: {
        equipmentId: equipment.id,
        reportedBy: req.user.id,
        reason,
        isAutoDetected: false,
        status: "REPORTED",
      },
      include: {
        equipment: {
          include: {
            lab: {
              include: {
                institute: true,
              },
            },
            status: true,
          },
        },
        reportedByUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    logger.info(
      `Equipment ${equipment.equipmentId} manually added to breakdown list by ${req.user.email}`
    );

    res.status(201).json({
      success: true,
      message: "Equipment added to breakdown list",
      data: breakdown,
    });
  });

  /**
   * Submit reorder request
   */
  submitReorderRequest = asyncHandler(async (req, res) => {
    const { breakdownId } = req.params;
    const {
      quantity = 1,
      urgency = "MEDIUM",
      reason,
      estimatedCost,
    } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Reason is required",
      });
    }

    // Get breakdown record
    const breakdown = await prisma.breakdownEquipment.findUnique({
      where: { id: breakdownId },
      include: {
        equipment: {
          include: {
            lab: true,
          },
        },
      },
    });

    if (!breakdown) {
      return res.status(404).json({
        success: false,
        message: "Breakdown record not found",
      });
    }

    // Check access
    if (
      req.user.role === USER_ROLE_ENUM.LAB_MANAGER &&
      (breakdown.equipment.lab.instituteId !== req.user.instituteId ||
        breakdown.equipment.lab.department !== req.user.department)
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this breakdown record",
      });
    }

    // Create reorder request
    const reorderRequest = await prisma.reorderRequest.create({
      data: {
        breakdownId,
        requestedBy: req.user.id,
        equipmentName: breakdown.equipment.name,
        quantity: parseInt(quantity),
        urgency,
        reason,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
        status: "PENDING",
      },
      include: {
        breakdown: {
          include: {
            equipment: {
              include: {
                lab: {
                  include: {
                    institute: true,
                  },
                },
              },
            },
          },
        },
        requestedByUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Update breakdown status
    await prisma.breakdownEquipment.update({
      where: { id: breakdownId },
      data: { status: "REORDER_PENDING" },
    });

    // Notify all policy makers
    const policyMakers = await prisma.user.findMany({
      where: {
        role: USER_ROLE_ENUM.POLICY_MAKER,
        isActive: true,
      },
      select: { id: true },
    });

    // Create notifications
    for (const pm of policyMakers) {
      const notification = await prisma.notification.create({
        data: {
          userId: pm.id,
          title: "New Reorder Request",
          message: `${req.user.firstName} ${req.user.lastName} has requested to reorder "${breakdown.equipment.name}" (Urgency: ${urgency})`,
          type: NOTIFICATION_TYPE.REORDER_REQUEST,
        },
      });

      broadcastNotification(pm.id, notification);
    }

    logger.info(
      `Reorder request created for equipment ${breakdown.equipment.equipmentId}`
    );

    res.status(201).json({
      success: true,
      message: "Reorder request submitted successfully",
      data: reorderRequest,
    });
  });

  /**
   * Get all reorder requests (for Policy Maker)
   */
  getReorderRequests = asyncHandler(async (req, res) => {
    const { status } = req.query;

    const where = {};
    if (status) {
      where.status = status;
    }

    const requests = await prisma.reorderRequest.findMany({
      where,
      include: {
        breakdown: {
          include: {
            equipment: {
              include: {
                lab: {
                  include: {
                    institute: true,
                  },
                },
              },
            },
          },
        },
        requestedByUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            instituteId: true,
            department: true,
          },
        },
        reviewedByUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        requestedAt: "desc",
      },
    });

    res.json({
      success: true,
      data: requests,
    });
  });

  /**
   * Review reorder request (Approve/Reject)
   */
  reviewReorderRequest = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const { action, comments } = req.body; // action: 'APPROVED' or 'REJECTED'

    if (!["APPROVED", "REJECTED"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be either APPROVED or REJECTED",
      });
    }

    // Get request
    const request = await prisma.reorderRequest.findUnique({
      where: { id: requestId },
      include: {
        breakdown: true,
        requestedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Reorder request not found",
      });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "This request has already been reviewed",
      });
    }

    // Update request
    const updatedRequest = await prisma.reorderRequest.update({
      where: { id: requestId },
      data: {
        status: action,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        reviewComments: comments || null,
      },
      include: {
        breakdown: {
          include: {
            equipment: {
              include: {
                lab: {
                  include: {
                    institute: true,
                  },
                },
              },
            },
          },
        },
        requestedByUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviewedByUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Update breakdown status
    await prisma.breakdownEquipment.update({
      where: { id: request.breakdownId },
      data: {
        status: action === "APPROVED" ? "REORDER_APPROVED" : "REORDER_REJECTED",
      },
    });

    // Notify requester
    const notification = await prisma.notification.create({
      data: {
        userId: request.requestedByUser.id,
        title: `Reorder Request ${action}`,
        message: `Your reorder request for "${
          updatedRequest.breakdown.equipment.name
        }" has been ${action.toLowerCase()} by ${req.user.firstName} ${
          req.user.lastName
        }`,
        type: NOTIFICATION_TYPE.REORDER_REQUEST,
      },
    });

    broadcastNotification(request.requestedByUser.id, notification);

    logger.info(`Reorder request ${requestId} ${action} by ${req.user.email}`);

    res.json({
      success: true,
      message: `Reorder request ${action.toLowerCase()} successfully`,
      data: updatedRequest,
    });
  });

  /**
   * Mark breakdown as resolved
   */
  resolveBreakdown = asyncHandler(async (req, res) => {
    const { breakdownId } = req.params;

    const breakdown = await prisma.breakdownEquipment.findUnique({
      where: { id: breakdownId },
      include: {
        equipment: {
          include: {
            lab: true,
          },
        },
      },
    });

    if (!breakdown) {
      return res.status(404).json({
        success: false,
        message: "Breakdown record not found",
      });
    }

    // Check access
    if (
      req.user.role === USER_ROLE_ENUM.LAB_MANAGER &&
      (breakdown.equipment.lab.instituteId !== req.user.instituteId ||
        breakdown.equipment.lab.department !== req.user.department)
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    await prisma.breakdownEquipment.update({
      where: { id: breakdownId },
      data: { status: "RESOLVED" },
    });

    logger.info(`Breakdown ${breakdownId} marked as resolved`);

    res.json({
      success: true,
      message: "Breakdown marked as resolved",
    });
  });
}

export default new BreakdownController();
