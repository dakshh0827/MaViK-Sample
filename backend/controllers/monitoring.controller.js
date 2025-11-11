import prisma from '../config/database.js';
import logger from '../utils/logger.js';
import { filterDataByRole } from '../middlewares/rbac.js';
import {
  broadcastAlert,
  broadcastNotification,
  broadcastEquipmentStatus,
} from '../config/socketio.js';
import { ALERT_SEVERITY, ALERT_TYPE, NOTIFICATION_TYPE } from '../utils/constants.js';

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class MonitoringController {
  // Get real-time equipment status
  getRealtimeStatus = asyncHandler(async (req, res) => {
    const roleFilter = filterDataByRole(req);
    const equipmentStatus = await prisma.equipment.findMany({
      where: { ...roleFilter, isActive: true },
      include: {
        status: true,
      },
      orderBy: { name: 'asc' },
    });

    const data = equipmentStatus.map((eq) => ({
      id: eq.id,
      equipmentId: eq.equipmentId,
      name: eq.name,
      department: eq.department,
      location: eq.location,
      status: eq.status?.status || 'OFFLINE',
      healthScore: eq.status?.healthScore || 0,
      temperature: eq.status?.temperature,
      vibration: eq.status?.vibration,
      energyConsumption: eq.status?.energyConsumption,
      lastUsedAt: eq.status?.lastUsedAt,
      updatedAt: eq.status?.updatedAt,
    }));
    res.json({ success: true, data });
  });

  // Get equipment sensor data
  getSensorData = asyncHandler(async (req, res) => {
    const { equipmentId } = req.params; // This is the string ID
    const { hours = 24 } = req.query;
    const timeThreshold = new Date(Date.now() - hours * 60 * 60 * 1000);

    const equipment = await prisma.equipment.findUnique({
      where: { equipmentId },
      select: { id: true },
    });

    if (!equipment) {
      return res.status(404).json({ success: false, message: 'Equipment not found.' });
    }

    const sensorData = await prisma.sensorData.findMany({
      where: {
        equipmentId: equipment.id,
        timestamp: { gte: timeThreshold },
      },
      orderBy: { timestamp: 'asc' },
    });

    res.json({ success: true, data: sensorData });
  });

  // Update equipment status (IoT endpoint)
  updateEquipmentStatus = asyncHandler(async (req, res) => {
    const { equipmentId } = req.params; // String ID from IoT device
    const {
      status,
      temperature,
      vibration,
      energyConsumption,
      pressure,
      humidity,
      rpm,
      voltage,
      current,
    } = req.body;

    const equipment = await prisma.equipment.findFirst({
      where: { equipmentId },
      select: { id: true, institute: true, name: true },
    });

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: 'Equipment not found.',
      });
    }
    
    const equipmentInternalId = equipment.id;

    const updatedStatus = await prisma.equipmentStatus.upsert({
      where: { equipmentId: equipmentInternalId },
      update: {
        ...(status && { status }),
        ...(temperature !== undefined && { temperature }),
        ...(vibration !== undefined && { vibration }),
        ...(energyConsumption !== undefined && { energyConsumption }),
        lastUsedAt: new Date(),
      },
      create: {
        equipmentId: equipmentInternalId,
        status: status || 'OPERATIONAL',
        temperature,
        vibration,
        energyConsumption,
      },
    });

    await prisma.sensorData.create({
      data: {
        equipmentId: equipmentInternalId,
        temperature,
        vibration,
        energyConsumption,
        pressure,
        humidity,
        rpm,
        voltage,
        current,
      },
    });

    // Check for anomalies (async, don't block response)
    this.checkAnomalies(equipment, req.body).catch((err) => {
      logger.error('Failed to check anomalies:', err);
    });

    broadcastEquipmentStatus(equipmentInternalId, updatedStatus);

    res.json({
      success: true,
      message: 'Equipment status updated successfully.',
      data: updatedStatus,
    });
  });

  // Check for anomalies and create alerts
  checkAnomalies = async (equipment, sensorData) => {
    try {
      const { id: equipmentId, institute, name: equipmentName } = equipment;
      const alertsToCreate = [];

      if (sensorData.temperature && sensorData.temperature > 80) {
        alertsToCreate.push({
          equipmentId,
          type: ALERT_TYPE.HIGH_TEMPERATURE,
          severity: sensorData.temperature > 100 ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.HIGH,
          title: `High Temperature: ${equipmentName}`,
          message: `Temperature reached ${sensorData.temperature}°C.`,
        });
      }
      if (sensorData.vibration && sensorData.vibration > 10) {
        alertsToCreate.push({
          equipmentId,
          type: ALERT_TYPE.ABNORMAL_VIBRATION,
          severity: sensorData.vibration > 15 ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.HIGH,
          title: `Abnormal Vibration: ${equipmentName}`,
          message: `Vibration detected at ${sensorData.vibration} mm/s.`,
        });
      }
      if (sensorData.energyConsumption && sensorData.energyConsumption > 50) {
        alertsToCreate.push({
          equipmentId,
          type: ALERT_TYPE.HIGH_ENERGY_CONSUMPTION,
          severity: ALERT_SEVERITY.MEDIUM,
          title: `High Energy Use: ${equipmentName}`,
          message: `Energy consumption spiked to ${sensorData.energyConsumption} kWh.`,
        });
      }

      if (alertsToCreate.length === 0) return;

      const usersToNotify = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: [
            { role: 'POLICY_MAKER' },
            { role: 'LAB_TECHNICIAN', institute: institute },
          ],
        },
        select: { id: true },
      });
      const userIds = usersToNotify.map((u) => u.id);

      for (const alertData of alertsToCreate) {
        const newAlert = await prisma.alert.create({
          data: {
            ...alertData,
            notifications: {
              create: userIds.map((userId) => ({
                userId: userId,
                title: alertData.title,
                message: alertData.message,
                type: NOTIFICATION_TYPE.ALERT,
              })),
            },
          },
          include: {
            notifications: true,
            equipment: { select: { name: true, equipmentId: true } },
          },
        });

        broadcastAlert(newAlert);
        for (const notification of newAlert.notifications) {
          broadcastNotification(notification.userId, notification);
        }
        logger.info(`Alert created and notifications sent for equipment ${equipmentId}`);
      }
    } catch (error) {
      logger.error('Check anomalies service error:', error);
    }
  };

  // Get dashboard overview
  getDashboardOverview = asyncHandler(async (req, res) => {
    const roleFilter = filterDataByRole(req);
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalEquipment,
      activeEquipment,
      unresolvedAlerts,
      maintenanceDue,
      avgHealthScore,
      recentAlerts,
      equipmentByStatus,
    ] = await Promise.all([
      prisma.equipment.count({ where: { ...roleFilter, isActive: true } }),
      prisma.equipmentStatus.count({
        where: {
          status: { in: ['OPERATIONAL', 'IN_USE'] },
          equipment: { ...roleFilter, isActive: true },
        },
      }),
      prisma.alert.count({
        where: {
          isResolved: false,
          equipment: roleFilter,
        },
      }),
      prisma.maintenanceLog.count({
        where: {
          status: { in: ['SCHEDULED', 'OVERDUE'] },
          scheduledDate: { lte: sevenDaysFromNow },
          equipment: { ...roleFilter, isActive: true },
        },
      }),
      prisma.equipmentStatus.aggregate({
        _avg: { healthScore: true },
        where: { equipment: { ...roleFilter, isActive: true } },
      }),
      prisma.alert.findMany({
        where: {
          isResolved: false,
          equipment: roleFilter,
        },
        include: {
          equipment: {
            select: {
              equipmentId: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.equipmentStatus.groupBy({
        by: ['status'],
        where: { equipment: { ...roleFilter, isActive: true } },
        _count: true,
      }),
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalEquipment,
          activeEquipment,
          unresolvedAlerts,
          maintenanceDue,
          avgHealthScore: Math.round(avgHealthScore._avg.healthScore || 0),
        },
        recentAlerts,
        equipmentByStatus: equipmentByStatus.map((s) => ({
          status: s.status,
          count: s._count,
        })),
      },
    });
  });
}

export default new MonitoringController();