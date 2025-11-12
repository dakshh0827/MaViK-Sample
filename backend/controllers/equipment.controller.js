import prisma from '../config/database.js';
import logger from '../utils/logger.js';
import { filterDataByRole } from '../middlewares/rbac.js';
import { DEPARTMENT_FIELD_MAP } from '../utils/constants.js';

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Helper function to map department-specific fields
 */
const mapDepartmentFields = (department, machineCategory, equipmentName) => {
  const fields = DEPARTMENT_FIELD_MAP[department];
  if (!fields) {
    return {};
  }
  return {
    ...(machineCategory && { [fields.cat]: machineCategory }),
    ...(equipmentName && { [fields.name]: equipmentName }),
  };
};

class EquipmentController {
  // Get all equipment
  getAllEquipment = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, department, status, institute, labId, search } = req.query;
    const skip = (page - 1) * limit;
    
    // 1. Get the base filter from RBAC
    const roleFilter = filterDataByRole(req);

    // 2. Add query parameter filters
    const where = {
      ...roleFilter, // Apply RBAC filter first
      ...(department && { department }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { equipmentId: { contains: search, mode: 'insensitive' } },
          { manufacturer: { contains: search, mode: 'insensitive' } },
        ],
      }),
      isActive: true,
    };

    // 3. Add conditional filters for Lab Techs and Policy Makers
    if (req.user.role !== 'TRAINER') {
      // Lab Techs and Policy Makers can filter by institute
      if (institute) {
        where.lab = { ...(where.lab || {}), institute: institute };
      }
      // Lab Techs and Policy Makers can filter by lab
      if (labId) {
        where.labId = labId;
      }
    }
    
    // 4. Add status filter
    if (status) {
      where.status = { status };
    }

    const [equipment, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        include: {
          status: true,
          lab: { select: { name: true, institute: true } },
          _count: {
            select: {
              alerts: { where: { isResolved: false } },
              maintenanceLogs: true,
            },
          },
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.equipment.count({ where }),
    ]);

    res.json({
      success: true,
      data: equipment,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // Get equipment by ID
  getEquipmentById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const roleFilter = filterDataByRole(req);

    const equipment = await prisma.equipment.findFirst({
      where: { id, ...roleFilter }, // Check access *before* fetching
      include: {
        status: true,
        lab: { select: { name: true, institute: true } },
        alerts: {
          where: { isResolved: false },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        maintenanceLogs: {
          orderBy: { scheduledDate: 'desc' },
          take: 5,
          include: {
            technician: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        usageAnalytics: {
          orderBy: { date: 'desc' },
          take: 7,
        },
      },
    });

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: 'Equipment not found or access denied.',
      });
    }

    res.json({
      success: true,
      data: equipment,
    });
  });

  // Create new equipment
  createEquipment = asyncHandler(async (req, res) => {
    const {
      equipmentId,
      name,
      department,
      machineCategory,
      equipmentName,
      manufacturer,
      model,
      serialNumber,
      purchaseDate,
      warrantyExpiry,
      labId, // This is the PUBLIC string labId from req.body
      specifications,
      imageUrl,
    } = req.body;

    const existing = await prisma.equipment.findUnique({ where: { equipmentId } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Equipment ID already exists.',
      });
    }
    
    // --- NEW: Lab ID Translation ---
    if (!labId) {
        return res.status(400).json({ success: false, message: 'labId is required.' });
    }
    const lab = await prisma.lab.findUnique({ where: { labId: labId }}); // Find lab by PUBLIC ID
    if (!lab) {
        return res.status(400).json({ success: false, message: 'Invalid Lab ID provided.'});
    }
    const labInternalId = lab.id; // Get the internal ObjectId for the relation
    // --- END NEW ---
    
    // (Security Check) Ensure Lab Tech can only add to their own institute
    if (req.user.role === 'LAB_TECHNICIAN' && lab.institute !== req.user.institute) {
        return res.status(403).json({ success: false, message: 'You can only add equipment to your own institute.' });
    }

    const departmentFields = mapDepartmentFields(department, machineCategory, equipmentName);

    const equipment = await prisma.equipment.create({
      data: {
        equipmentId,
        name,
        department,
        ...departmentFields,
        manufacturer,
        model,
        serialNumber,
        purchaseDate: new Date(purchaseDate),
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
        labId: labInternalId, // Use the translated internal ID
        specifications,
        imageUrl,
        status: {
          create: {
            status: 'IDLE',
            healthScore: 100,
          },
        },
      },
      include: {
        status: true,
        lab: true,
      },
    });

    logger.info(`Equipment created: ${equipmentId} by ${req.user.email}`);
    res.status(201).json({
      success: true,
      message: 'Equipment created successfully.',
      data: equipment,
    });
  });

  // Update equipment
  updateEquipment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { department, machineCategory, equipmentName, labId, ...updateData } = req.body;

    delete updateData.equipmentId;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // First, check if equipment exists and user has access
    const roleFilter = filterDataByRole(req);
    const existingEquipment = await prisma.equipment.findFirst({
        where: { id, ...roleFilter },
        include: { lab: true }
    });

    if (!existingEquipment) {
        return res.status(404).json({ success: false, message: 'Equipment not found or access denied.' });
    }

    let departmentFields = {};
    if (department) {
      const oldFields = mapDepartmentFields(existingEquipment.department, 'clear', 'clear');
      for (const key in oldFields) {
        updateData[key] = null;
      }
      departmentFields = mapDepartmentFields(department, machineCategory, equipmentName);
      updateData.department = department;
    }
    
    // --- NEW: Lab ID Translation (on update) ---
    if (labId && labId !== existingEquipment.lab.labId) { // Check against public labId
        const newLab = await prisma.lab.findUnique({ where: { labId: labId }}); // Find by public labId
        if (!newLab) {
            return res.status(400).json({ success: false, message: 'Invalid new Lab ID.'});
        }
        // Lab Tech can only move equipment *within* their institute
        if (req.user.role === 'LAB_TECHNICIAN' && newLab.institute !== req.user.institute) {
            return res.status(403).json({ success: false, message: 'You can only move equipment within your own institute.' });
        }
        updateData.labId = newLab.id; // Set the internal ID for the relation
    }
    // --- END NEW ---

    const equipment = await prisma.equipment.update({
      where: { id },
      data: {
        ...updateData,
        ...departmentFields,
        ...(updateData.purchaseDate && { purchaseDate: new Date(updateData.purchaseDate) }),
        ...(updateData.warrantyExpiry && { warrantyExpiry: new Date(updateData.warrantyExpiry) }),
      },
      include: {
        status: true,
        lab: true,
      },
    });

    logger.info(`Equipment updated: ${equipment.equipmentId} by ${req.user.email}`);
    res.json({
      success: true,
      message: 'Equipment updated successfully.',
      data: equipment,
    });
  });

  // Delete equipment (soft delete)
  deleteEquipment = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check access first
    const roleFilter = filterDataByRole(req);
    const equipment = await prisma.equipment.findFirst({
        where: { id, ...roleFilter }
    });
    if (!equipment) {
        return res.status(404).json({ success: false, message: 'Equipment not found or access denied.' });
    }

    const deletedEquipment = await prisma.equipment.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info(`Equipment deleted: ${deletedEquipment.equipmentId} by ${req.user.email}`);
    res.json({
      success: true,
      message: 'Equipment deleted successfully.',
    });
  });

  // Get equipment statistics
  getEquipmentStats = asyncHandler(async (req, res) => {
    const roleFilter = filterDataByRole(req);

    const [total, byStatus, byDepartment] = await Promise.all([
      prisma.equipment.count({ where: { ...roleFilter, isActive: true } }),
      prisma.equipmentStatus.groupBy({
        by: ['status'],
        where: { equipment: { ...roleFilter, isActive: true } },
        _count: true,
      }),
      prisma.equipment.groupBy({
        by: ['department'],
        where: { ...roleFilter, isActive: true },
        _count: true,
      }),
    ]);

    const statusCounts = byStatus.reduce((acc, s) => {
      acc[s.status] = s._count;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        total,
        byStatus: {
          OPERATIONAL: statusCounts.OPERATIONAL || 0,
          IN_USE: statusCounts.IN_USE || 0,
          FAULTY: statusCounts.FAULTY || 0,
          MAINTENANCE: statusCounts.MAINTENANCE || 0,
          OFFLINE: statusCounts.OFFLINE || 0,
          IDLE: statusCounts.IDLE || 0,
          WARNING: statusCounts.WARNING || 0,
        },
        byDepartment: byDepartment.map((d) => ({
          department: d.department,
          count: d._count,
        })),
      },
    });
  });
}

export default new EquipmentController();