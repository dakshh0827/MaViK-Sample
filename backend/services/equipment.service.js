import prisma from '../config/database.js';
import logger from '../utils/logger.js';
import { DEPARTMENT_FIELD_MAP } from '../utils/constants.js';

/**
 * Helper function to map department-specific fields
 * @param {string} department - The department enum
 * @param {string} machineCategory - The machine category
 * @param {string} equipmentName - The equipment name
 * @returns {object} - Mapped data object
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

class EquipmentService {
  /**
   * Gets a paginated list of all equipment.
   * @param {object} queryParams - Page, limit, department, status, etc.
   * @param {object} roleFilter - RBAC filter from middleware.
   * @returns {object} { equipment, pagination }
   */
  async getAllEquipment(queryParams, roleFilter) {
    const { page = 1, limit = 10, department, status, institute, search } = queryParams;
    const skip = (page - 1) * limit;

    const where = {
      ...roleFilter,
      ...(department && { department }),
      ...(institute && { institute }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { equipmentId: { contains: search, mode: 'insensitive' } },
          { manufacturer: { contains: search, mode: 'insensitive' } },
        ],
      }),
      isActive: true,
    };

    // Add status filter if provided
    if (status) {
      where.status = { status };
    }

    const [equipment, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        include: {
          status: true,
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

    return {
      equipment,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Gets a single equipment by its ID, with related data.
   * @param {string} id - The equipment's internal ID.
   * @param {object} roleFilter - RBAC filter from middleware.
   * @returns {object} The equipment object.
   */
  async getEquipmentById(id, roleFilter) {
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: {
        status: true,
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
      const error = new Error('Equipment not found.');
      error.statusCode = 404;
      throw error;
    }

    // Check role-based access
    if (roleFilter.institute && equipment.institute !== roleFilter.institute) {
      const error = new Error('Access denied to this equipment.');
      error.statusCode = 403;
      throw error;
    }

    return equipment;
  }

  /**
   * Creates a new equipment.
   * @param {object} equipmentData - Data for the new equipment.
   * @param {object} user - The user performing the action.
   * @returns {object} The created equipment.
   */
  async createEquipment(equipmentData, user) {
    const {
      equipmentId,
      name,
      department,
      machineCategory, // Generic field from request
      equipmentName,   // Generic field from request
      manufacturer,
      model,
      serialNumber,
      purchaseDate,
      warrantyExpiry,
      location,
      institute,
      specifications,
      imageUrl,
    } = equipmentData;

    // Check if equipment ID already exists
    const existing = await prisma.equipment.findUnique({ where: { equipmentId } });
    if (existing) {
      const error = new Error('Equipment ID already exists.');
      error.statusCode = 409;
      throw error;
    }

    // Map department-specific fields
    const departmentFields = mapDepartmentFields(department, machineCategory, equipmentName);

    // Create equipment and initial status
    const equipment = await prisma.equipment.create({
      data: {
        equipmentId,
        name,
        department,
        ...departmentFields, // Add mapped fields
        manufacturer,
        model,
        serialNumber,
        purchaseDate: new Date(purchaseDate),
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
        location,
        institute,
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
      },
    });

    logger.info(`Equipment created: ${equipmentId} by ${user.email}`);
    return equipment;
  }

  /**
   * Updates an existing equipment.
   * @param {string} id - The equipment's internal ID.
   * @param {object} updateData - Data to update.
   * @param {object} user - The user performing the action.
   * @returns {object} The updated equipment.
   */
  async updateEquipment(id, updateData, user) {
    const { department, machineCategory, equipmentName, ...restData } = updateData;

    // Remove fields that shouldn't be updated directly
    delete restData.equipmentId;
    delete restData.createdAt;
    delete restData.updatedAt;

    let departmentFields = {};
    if (department) {
      // Get existing equipment to know which fields to clear
      const existingEquipment = await prisma.equipment.findUnique({ where: { id } });
      
      // Clear old department-specific fields
      const oldFields = mapDepartmentFields(existingEquipment.department, 'clear', 'clear');
      for (const key in oldFields) {
        restData[key] = null;
      }

      // Add new ones
      departmentFields = mapDepartmentFields(department, machineCategory, equipmentName);
      restData.department = department;
    }

    const equipment = await prisma.equipment.update({
      where: { id },
      data: {
        ...restData,
        ...departmentFields,
        ...(restData.purchaseDate && { purchaseDate: new Date(restData.purchaseDate) }),
        ...(restData.warrantyExpiry && { warrantyExpiry: new Date(restData.warrantyExpiry) }),
      },
      include: {
        status: true,
      },
    });

    logger.info(`Equipment updated: ${equipment.equipmentId} by ${user.email}`);
    return equipment;
  }

  /**
   * Soft deletes an equipment by setting isActive to false.
   * @param {string} id - The equipment's internal ID.
   * @param {object} user - The user performing the action.
   */
  async deleteEquipment(id, user) {
    const equipment = await prisma.equipment.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info(`Equipment deleted: ${equipment.equipmentId} by ${user.email}`);
    return { message: 'Equipment deleted successfully.' };
  }

  /**
   * Gets equipment statistics.
   * @param {object} roleFilter - RBAC filter from middleware.
   * @returns {object} Statistics object.
   */
  async getEquipmentStats(roleFilter) {
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

    return {
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
    };
  }
}

export default new EquipmentService();