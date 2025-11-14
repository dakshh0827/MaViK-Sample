/*
 * =====================================================
 * backend/controllers/lab.controller.js (FIXED)
 * =====================================================
 */
import prisma from "../config/database.js";
import logger from "../utils/logger.js";
import { USER_ROLE_ENUM } from "../utils/constants.js";

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class LabController {
  // Get all labs (filtered by role)
  getAllLabs = asyncHandler(async (req, res) => {
    const { institute, department } = req.query;
    const { role, instituteId: userInstituteId, department: userDepartment } = req.user;

    let where = {};

    // Apply role-based filtering
    if (role === USER_ROLE_ENUM.LAB_MANAGER) {
      // Lab managers only see labs in their institute and department
      where.instituteId = userInstituteId;
      where.department = userDepartment;
    } else if (role === USER_ROLE_ENUM.TRAINER) {
      // Trainers only see their assigned lab
      if (req.user.labId) {
        where.id = req.user.labId;
      } else {
        // If no lab assigned, return empty
        return res.json({ success: true, data: [] });
      }
    }
    // POLICY_MAKER sees all labs (no additional filter)

    // Apply query filters
    if (institute && role === USER_ROLE_ENUM.POLICY_MAKER) {
      where.instituteId = institute;
    }
    if (department && role !== USER_ROLE_ENUM.TRAINER) {
      where.department = department;
    }

    const labs = await prisma.lab.findMany({
      where,
      include: {
        institute: {
          select: {
            id: true,
            instituteId: true,
            name: true,
          },
        },
        _count: {
          select: {
            equipments: { where: { isActive: true } },
            trainers: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    res.json({
      success: true,
      data: labs,
    });
  });

  // Get lab by ID
  getLabById = asyncHandler(async (req, res) => {
    const { labId } = req.params;
    const { role, instituteId: userInstituteId, department: userDepartment, labId: userLabId } = req.user;

    const lab = await prisma.lab.findUnique({
      where: { labId },
      include: {
        institute: {
          select: {
            id: true,
            instituteId: true,
            name: true,
          },
        },
        equipments: {
          where: { isActive: true },
          select: {
            id: true,
            equipmentId: true,
            name: true,
            status: true,
          },
        },
        trainers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!lab) {
      return res.status(404).json({
        success: false,
        message: "Lab not found.",
      });
    }

    // Check access
    if (role === USER_ROLE_ENUM.LAB_MANAGER) {
      if (lab.instituteId !== userInstituteId || lab.department !== userDepartment) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this lab.",
        });
      }
    } else if (role === USER_ROLE_ENUM.TRAINER) {
      if (lab.id !== userLabId) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this lab.",
        });
      }
    }

    res.json({
      success: true,
      data: lab,
    });
  });

  // Get lab summary with analytics
  getLabSummary = asyncHandler(async (req, res) => {
    const { labId } = req.params;
    const { role, instituteId: userInstituteId, department: userDepartment, labId: userLabId } = req.user;

    // Find lab with access check
    const lab = await prisma.lab.findUnique({
      where: { labId },
      include: {
        institute: {
          select: {
            id: true,
            instituteId: true,
            name: true,
          },
        },
      },
    });

    if (!lab) {
      return res.status(404).json({
        success: false,
        message: "Lab not found.",
      });
    }

    // Check access
    if (role === USER_ROLE_ENUM.LAB_MANAGER) {
      if (lab.instituteId !== userInstituteId || lab.department !== userDepartment) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this lab.",
        });
      }
    } else if (role === USER_ROLE_ENUM.TRAINER) {
      if (lab.id !== userLabId) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this lab.",
        });
      }
    }

    // Get equipment in this lab
    const equipment = await prisma.equipment.findMany({
      where: { 
        labId: lab.id,
        isActive: true 
      },
      include: {
        status: true,
        analyticsParams: true,
      },
    });

    // Calculate statistics
    const totalEquipment = equipment.length;
    const avgHealthScore = totalEquipment > 0
      ? equipment.reduce((sum, eq) => sum + (eq.status?.healthScore || 0), 0) / totalEquipment
      : 0;

    const totalUptime = equipment.reduce((sum, eq) => 
      sum + (eq.analyticsParams?.totalUptime || 0), 0
    );

    const totalDowntime = equipment.reduce((sum, eq) => 
      sum + (eq.analyticsParams?.totalDowntime || 0), 0
    );

    const inClassEquipment = equipment.filter(eq => 
      eq.status?.isOperatingInClass === true
    ).length;

    res.json({
      success: true,
      data: {
        lab: {
          labId: lab.labId,
          name: lab.name,
          institute: lab.institute,
          department: lab.department,
        },
        statistics: {
          totalEquipment,
          avgHealthScore,
          totalUptime,
          totalDowntime,
          inClassEquipment,
        },
        equipment: equipment.map(eq => ({
          id: eq.id,
          equipmentId: eq.equipmentId,
          name: eq.name,
          status: eq.status?.status,
          healthScore: eq.status?.healthScore,
        })),
      },
    });
  });

  // Create lab (Policy Maker only)
  createLab = asyncHandler(async (req, res) => {
    const { labId, name, instituteId, department } = req.body;

    // Check if labId already exists
    const existing = await prisma.lab.findUnique({
      where: { labId },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Lab ID already exists.",
      });
    }

    // Verify institute exists
    const institute = await prisma.institute.findUnique({
      where: { instituteId },
    });

    if (!institute) {
      return res.status(400).json({
        success: false,
        message: `Institute with ID "${instituteId}" not found.`,
      });
    }

    const lab = await prisma.lab.create({
      data: {
        labId,
        name,
        instituteId,
        department,
      },
      include: {
        institute: {
          select: {
            id: true,
            instituteId: true,
            name: true,
          },
        },
      },
    });

    logger.info(`Lab created: ${labId} by ${req.user.email}`);
    res.status(201).json({
      success: true,
      message: "Lab created successfully.",
      data: lab,
    });
  });

  // Update lab (Policy Maker only)
  updateLab = asyncHandler(async (req, res) => {
    const { labId } = req.params;
    const { name, instituteId, department } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (instituteId) {
      // Verify new institute exists
      const institute = await prisma.institute.findUnique({
        where: { instituteId },
      });
      if (!institute) {
        return res.status(400).json({
          success: false,
          message: `Institute with ID "${instituteId}" not found.`,
        });
      }
      updateData.instituteId = instituteId;
    }
    if (department) updateData.department = department;

    try {
      const lab = await prisma.lab.update({
        where: { labId },
        data: updateData,
        include: {
          institute: {
            select: {
              id: true,
              instituteId: true,
              name: true,
            },
          },
        },
      });

      logger.info(`Lab updated: ${labId} by ${req.user.email}`);
      res.json({
        success: true,
        message: "Lab updated successfully.",
        data: lab,
      });
    } catch (error) {
      if (error.code === "P2025") {
        return res.status(404).json({
          success: false,
          message: "Lab not found.",
        });
      }
      throw error;
    }
  });

  // Delete lab (Policy Maker only)
  deleteLab = asyncHandler(async (req, res) => {
    const { labId } = req.params;

    // Check if lab has equipment
    const lab = await prisma.lab.findUnique({
      where: { labId },
      include: {
        _count: {
          select: {
            equipments: { where: { isActive: true } },
          },
        },
      },
    });

    if (!lab) {
      return res.status(404).json({
        success: false,
        message: "Lab not found.",
      });
    }

    if (lab._count.equipments > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete lab. It has ${lab._count.equipments} active equipment. Please remove or reassign equipment first.`,
      });
    }

    await prisma.lab.delete({
      where: { labId },
    });

    logger.info(`Lab deleted: ${labId} by ${req.user.email}`);
    res.json({
      success: true,
      message: "Lab deleted successfully.",
    });
  });
}

export default new LabController();