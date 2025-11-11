import prisma from '../config/database.js';
import logger from '../utils/logger.js';
import { filterDataByRole } from '../middlewares/rbac.js';

class EquipmentController {
  // Get all equipment
  async getAllEquipment(req, res) {
    try {
      const { page = 1, limit = 10, category, status, institute, search } = req.query;
      const skip = (page - 1) * limit;

      // Apply role-based filtering
      const roleFilter = filterDataByRole(req);

      const where = {
        ...roleFilter,
        ...(category && { category }),
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
    } catch (error) {
      logger.error('Get equipment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch equipment.',
        error: error.message,
      });
    }
  }

  // Get equipment by ID
  async getEquipmentById(req, res) {
    try {
      const { id } = req.params;

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
        return res.status(404).json({
          success: false,
          message: 'Equipment not found.',
        });
      }

      // Check role-based access
      const roleFilter = filterDataByRole(req);
      if (roleFilter.institute && equipment.institute !== roleFilter.institute) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this equipment.',
        });
      }

      res.json({
        success: true,
        data: equipment,
      });
    } catch (error) {
      logger.error('Get equipment by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch equipment.',
        error: error.message,
      });
    }
  }

  // Create new equipment
  async createEquipment(req, res) {
    try {
      const {
        equipmentId,
        name,
        category,
        manufacturer,
        model,
        serialNumber,
        purchaseDate,
        warrantyExpiry,
        location,
        institute,
        specifications,
        imageUrl,
      } = req.body;

      // Check if equipment ID already exists
      const existing = await prisma.equipment.findUnique({
        where: { equipmentId },
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Equipment ID already exists.',
        });
      }

      // Create equipment and initial status
      const equipment = await prisma.equipment.create({
        data: {
          equipmentId,
          name,
          category,
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

      logger.info(`Equipment created: ${equipmentId} by ${req.user.email}`);

      res.status(201).json({
        success: true,
        message: 'Equipment created successfully.',
        data: equipment,
      });
    } catch (error) {
      logger.error('Create equipment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create equipment.',
        error: error.message,
      });
    }
  }

  // Update equipment
  async updateEquipment(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Remove fields that shouldn't be updated directly
      delete updateData.equipmentId;
      delete updateData.createdAt;
      delete updateData.updatedAt;

      const equipment = await prisma.equipment.update({
        where: { id },
        data: {
          ...updateData,
          ...(updateData.purchaseDate && { purchaseDate: new Date(updateData.purchaseDate) }),
          ...(updateData.warrantyExpiry && { warrantyExpiry: new Date(updateData.warrantyExpiry) }),
        },
        include: {
          status: true,
        },
      });

      logger.info(`Equipment updated: ${equipment.equipmentId} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'Equipment updated successfully.',
        data: equipment,
      });
    } catch (error) {
      logger.error('Update equipment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update equipment.',
        error: error.message,
      });
    }
  }

  // Delete equipment (soft delete)
  async deleteEquipment(req, res) {
    try {
      const { id } = req.params;

      const equipment = await prisma.equipment.update({
        where: { id },
        data: { isActive: false },
      });

      logger.info(`Equipment deleted: ${equipment.equipmentId} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'Equipment deleted successfully.',
      });
    } catch (error) {
      logger.error('Delete equipment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete equipment.',
        error: error.message,
      });
    }
  }

  // Get equipment statistics
  async getEquipmentStats(req, res) {
    try {
      const roleFilter = filterDataByRole(req);

      const [
        total,
        operational,
        inUse,
        faulty,
        maintenance,
        offline,
        categories,
      ] = await Promise.all([
        prisma.equipment.count({ where: { ...roleFilter, isActive: true } }),
        prisma.equipmentStatus.count({ where: { status: 'OPERATIONAL', equipment: roleFilter } }),
        prisma.equipmentStatus.count({ where: { status: 'IN_USE', equipment: roleFilter } }),
        prisma.equipmentStatus.count({ where: { status: 'FAULTY', equipment: roleFilter } }),
        prisma.equipmentStatus.count({ where: { status: 'MAINTENANCE', equipment: roleFilter } }),
        prisma.equipmentStatus.count({ where: { status: 'OFFLINE', equipment: roleFilter } }),
        prisma.equipment.groupBy({
          by: ['category'],
          where: { ...roleFilter, isActive: true },
          _count: true,
        }),
      ]);

      res.json({
        success: true,
        data: {
          total,
          byStatus: {
            operational,
            inUse,
            faulty,
            maintenance,
            offline,
            idle: total - (operational + inUse + faulty + maintenance + offline),
          },
          byCategory: categories.map((c) => ({
            category: c.category,
            count: c._count,
          })),
        },
      });
    } catch (error) {
      logger.error('Get equipment stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch equipment statistics.',
        error: error.message,
      });
    }
  }
}

export default new EquipmentController();
