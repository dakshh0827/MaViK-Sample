/*
 * =====================================================
 * backend/controllers/institute.controller.js (FIXED)
 * =====================================================
 */
import prisma from "../config/database.js";
import logger from "../utils/logger.js";

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class InstituteController {
  // Get all institutes
  getAllInstitutes = asyncHandler(async (req, res) => {
    const institutes = await prisma.institute.findMany({
      include: {
        _count: {
          select: {
            labs: true,
            users: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    res.json({
      success: true,
      data: institutes,
    });
  });

  // Create institute (Policy Maker only)
  createInstitute = asyncHandler(async (req, res) => {
    const { name, instituteId } = req.body;

    // Check if institute with same name or ID exists
    const existing = await prisma.institute.findFirst({
      where: {
        OR: [
          { name },
          { instituteId },
        ],
      },
    });

    if (existing) {
      if (existing.name === name) {
        return res.status(409).json({
          success: false,
          message: "An institute with this name already exists.",
        });
      }
      if (existing.instituteId === instituteId) {
        return res.status(409).json({
          success: false,
          message: "An institute with this ID already exists.",
        });
      }
    }

    const institute = await prisma.institute.create({
      data: {
        name,
        instituteId: instituteId.toUpperCase(),
      },
    });

    logger.info(`Institute created: ${institute.instituteId} by ${req.user.email}`);
    res.status(201).json({
      success: true,
      message: "Institute created successfully.",
      data: institute,
    });
  });

  // Update institute (Policy Maker only)
  updateInstitute = asyncHandler(async (req, res) => {
    const { instituteId } = req.params;
    const { name } = req.body;

    // Check if new name conflicts with another institute
    if (name) {
      const existing = await prisma.institute.findFirst({
        where: {
          name,
          instituteId: { not: instituteId },
        },
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Another institute with this name already exists.",
        });
      }
    }

    try {
      const institute = await prisma.institute.update({
        where: { instituteId },
        data: { name },
      });

      logger.info(`Institute updated: ${instituteId} by ${req.user.email}`);
      res.json({
        success: true,
        message: "Institute updated successfully.",
        data: institute,
      });
    } catch (error) {
      if (error.code === "P2025") {
        return res.status(404).json({
          success: false,
          message: "Institute not found.",
        });
      }
      throw error;
    }
  });

  // Delete institute (Policy Maker only)
  deleteInstitute = asyncHandler(async (req, res) => {
    const { instituteId } = req.params;

    // Check if institute has labs or users
    const institute = await prisma.institute.findUnique({
      where: { instituteId },
      include: {
        _count: {
          select: {
            labs: true,
            users: true,
          },
        },
      },
    });

    if (!institute) {
      return res.status(404).json({
        success: false,
        message: "Institute not found.",
      });
    }

    if (institute._count.labs > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete institute. It has ${institute._count.labs} lab(s). Please remove labs first.`,
      });
    }

    if (institute._count.users > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete institute. It has ${institute._count.users} user(s). Please reassign users first.`,
      });
    }

    await prisma.institute.delete({
      where: { instituteId },
    });

    logger.info(`Institute deleted: ${instituteId} by ${req.user.email}`);
    res.json({
      success: true,
      message: "Institute deleted successfully.",
    });
  });
}

export default new InstituteController();