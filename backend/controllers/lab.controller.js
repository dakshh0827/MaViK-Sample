import prisma from '../config/database.js';
import logger from '../utils/logger.js';
import { USER_ROLE_ENUM } from '../utils/constants.js';

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class LabController {
  /**
   * Create a new lab. (Lab Technician only)
   * A Lab Tech can only create a lab for their *own* institute.
   */
  createLab = asyncHandler(async (req, res) => {
    const { labId, name } = req.body;
    const institute = req.user.institute; // --- FIX: Force institute from user's token

    if (!institute) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Your account is not associated with an institute.',
      });
    }

    // Check if public labId is unique
    const existingLabId = await prisma.lab.findUnique({
      where: { labId },
    });
    if (existingLabId) {
      return res.status(409).json({
        success: false,
        message: 'A lab with this Lab ID already exists.',
      });
    }
    
    // Check for duplicate name *within the same institute*
    const existingNameInInstitute = await prisma.lab.findFirst({
      where: { name, institute }
    });
    if (existingNameInInstitute) {
      return res.status(409).json({
        success: false,
        message: `A lab named "${name}" already exists in ${institute}.`,
      });
    }

    const lab = await prisma.lab.create({
      data: {
        labId,
        name,
        institute, // Force institute
      },
    });

    logger.info(`Lab created: ${name} (${labId}) in ${institute} by ${req.user.email}`);
    res.status(201).json({ success: true, data: lab });
  });

  /**
   * Get all labs.
   * Policy Maker gets all labs (can filter by institute).
   * Lab Technician gets all labs *in their institute*.
   */
  getAllLabs = asyncHandler(async (req, res) => {
    const { institute } = req.query;
    let where = {};

    if (req.user.role === USER_ROLE_ENUM.LAB_TECHNICIAN) {
      where.institute = req.user.institute; // Force filter
    } else if (req.user.role === USER_ROLE_ENUM.POLICY_MAKER && institute) {
      where.institute = institute; // Allow filter
    }

    const labs = await prisma.lab.findMany({
      where,
      include: {
        _count: {
          select: { equipments: true, trainers: true },
        },
      },
      orderBy: [{ institute: 'asc' }, { name: 'asc' }],
    });

    res.json({ success: true, data: labs });
  });

  /**
   * Get a single lab by its public labId.
   */
  getLabById = asyncHandler(async (req, res) => {
    const { labId } = req.params;
    const lab = await prisma.lab.findUnique({
      where: { labId: labId },
      include: {
        equipments: { where: { isActive: true }, select: { id: true, name: true, equipmentId: true } },
        trainers: { where: { isActive: true }, select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!lab) {
      return res.status(404).json({ success: false, message: 'Lab not found.' });
    }
    
    // Security check for Lab Tech
    if (req.user.role === USER_ROLE_ENUM.LAB_TECHNICIAN && lab.institute !== req.user.institute) {
        return res.status(403).json({ success: false, message: 'Access denied. You can only view labs in your own institute.'});
    }

    res.json({ success: true, data: lab });
  });

  /**
   * Update a lab. (Lab Technician only)
   * Can only update labs in their own institute.
   */
  updateLab = asyncHandler(async (req, res) => {
    const { labId } = req.params;
    const { name } = req.body; // Can only update name, not institute or labId
    const institute = req.user.institute;

    // Find the lab first to ensure it exists and belongs to the user's institute
    const existingLab = await prisma.lab.findUnique({
      where: { labId: labId },
    });

    if (!existingLab) {
      return res.status(404).json({ success: false, message: 'Lab not found.' });
    }

    // Security Check
    if (existingLab.institute !== institute) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update labs in your own institute.',
      });
    }
    
    // Check if new name is a duplicate *within the same institute*
    if (name && name !== existingLab.name) {
        const existingNameInInstitute = await prisma.lab.findFirst({
            where: { name, institute, NOT: { labId: labId } }
        });
        if (existingNameInInstitute) {
            return res.status(409).json({
                success: false,
                message: `A lab named "${name}" already exists in ${institute}.`,
            });
        }
    }

    try {
      const lab = await prisma.lab.update({
        where: { labId: labId },
        data: {
          name, // Only allow name to be updated
        },
      });
      logger.info(`Lab updated: ${lab.labId} by ${req.user.email}`);
      res.json({ success: true, data: lab });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ success: false, message: 'Lab not found.' });
      }
      throw error;
    }
  });

  /**
   * Delete a lab. (Lab Technician only)
   * Can only delete labs in their own institute.
   */
  deleteLab = asyncHandler(async (req, res) => {
    const { labId } = req.params;
    const institute = req.user.institute;

    // Check if lab exists and belongs to the user's institute
    const lab = await prisma.lab.findFirst({
      where: { labId: labId, institute: institute },
      include: {
        _count: {
          select: { equipments: true, trainers: true },
        },
      },
    });
    
    if (!lab) {
      return res.status(404).json({ success: false, message: 'Lab not found or access denied.' });
    }

    if (lab._count.equipments > 0 || lab._count.trainers > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete lab. Reassign all equipment and trainers first.',
        data: {
            equipmentCount: lab._count.equipments,
            trainerCount: lab._count.trainers
        }
      });
    }

    try {
      await prisma.lab.delete({
        where: { labId: labId },
      });
      logger.info(`Lab deleted: ${labId} by ${req.user.email}`);
      res.json({ success: true, message: 'Lab deleted successfully.' });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ success: false, message: 'Lab not found.' });
      }
      throw error;
    }
  });
}

export default new LabController();