import prisma from '../config/database.js';
import logger from '../utils/logger.js';
import { filterDataByRole } from '../middlewares/rbac.js';
import {
  broadcastAlert,
  broadcastNotification,
  broadcastEquipmentStatus,
} from '../config/socketio.js';
import { ALERT_SEVERITY, ALERT_TYPE, NOTIFICATION_TYPE, USER_ROLE_ENUM } from '../utils/constants.js';

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Gets the high-level, centralized dashboard for Policy Makers.
 */
const getPolicyMakerDashboard = async () => {
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // 1. Get high-level overview stats
  const [
    totalEquipment,
    unresolvedAlerts,
    maintenanceDue,
    avgHealthScore,
    institutionData,
  ] = await Promise.all([
    prisma.equipment.count({ where: { isActive: true } }),
    prisma.alert.count({ where: { isResolved: false } }),
    prisma.maintenanceLog.count({
      where: {
        status: { in: ['SCHEDULED', 'OVERDUE'] },
        scheduledDate: { lte: sevenDaysFromNow },
        equipment: { isActive: true },
      },
    }),
    prisma.equipmentStatus.aggregate({
      _avg: { healthScore: true },
      where: { equipment: { isActive: true } },
    }),
    // 2. Get list of all institutions and their individual stats
    prisma.lab.groupBy({
      by: ['institute'],
      _count: {
        _all: true, // Counts number of labs
      },
      orderBy: {
        institute: 'asc',
      },
    }),
  ]);
  
  // 3. Get equipment and alert counts for each institution
  const equipmentByInstitute = await prisma.equipment.groupBy({
    by: ['lab.institute'],
    where: { isActive: true },
    _count: { id: true }
  });
  
  const alertsByInstitute = await prisma.alert.groupBy({
    by: ['equipment.lab.institute'],
    where: { isResolved: false, equipment: { isActive: true } },
    _count: { id: true },
  });

  // Map counts to lookups for easier merging
  const equipmentMap = equipmentByInstitute.reduce((acc, item) => {
    acc[item['lab.institute']] = item._count.id;
    return acc;
  }, {});
  const alertMap = alertsByInstitute.reduce((acc, item) => {
    acc[item['equipment.lab.institute']] = item._count.id;
    return acc;
  }, {});

  // 4. Combine lab counts, equipment counts, and alert counts
  const institutions = institutionData.map(inst => ({
    name: inst.institute,
    labCount: inst._count._all,
    equipmentCount: equipmentMap[inst.institute] || 0,
    unresolvedAlerts: alertMap[inst.institute] || 0,
  }));

  return {
    overview: {
      totalInstitutions: institutions.length,
      totalEquipment,
      unresolvedAlerts,
      maintenanceDue,
      avgHealthScore: Math.round(avgHealthScore._avg.healthScore || 0),
    },
    institutions, // The list of institutions and their stats
  };
};

/**
 * Gets the institute-specific dashboard for Lab Technicians and Trainers.
 */
const getLabTechAndUserDashboard = async (roleFilter) => {
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
            lab: { select: { name: true } }
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

  return {
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
  };
};


class MonitoringController {
  
  getRealtimeStatus = asyncHandler(async (req, res) => {
    const roleFilter = filterDataByRole(req);
    const equipmentStatus = await prisma.equipment.findMany({
      where: { ...roleFilter, isActive: true },
      include: {
        status: true,
        lab: { select: { name: true, institute: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: equipmentStatus.map((eq) => ({
        id: eq.id,
        equipmentId: eq.equipmentId,
        name: eq.name,
        department: eq.department,
        labName: eq.lab.name,
        institute: eq.lab.institute,
        status: eq.status?.status || 'OFFLINE',
        healthScore: eq.status?.healthScore || 0,
        temperature: eq.status?.temperature,
        vibration: eq.status?.vibration,
        energyConsumption: eq.status?.energyConsumption,
        lastUsedAt: eq.status?.lastUsedAt,
        updatedAt: eq.status?.updatedAt,
      })),
    });
  });

  getSensorData = asyncHandler(async (req, res) => {
    const { equipmentId } = req.params; // This is the string ID
    const { hours = 24 } = req.query;
    const timeThreshold = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Find the equipment's internal ID
    const equipment = await prisma.equipment.findUnique({
      where: { equipmentId },
      select: { id: true },
    });
    if (!equipment) {
        return res.status(404).json({ success: false, message: 'Equipment not found.'});
    }

    // Check if user has access to this equipment
    const roleFilter = filterDataByRole(req);
    const hasAccess = await prisma.equipment.findFirst({
        where: { id: equipment.id, ...roleFilter }
    });
    if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied to this equipment.'});
    }

    const sensorData = await prisma.sensorData.findMany({
      where: {
        equipmentId: equipment.id,
        timestamp: { gte: timeThreshold },
      },
      orderBy: { timestamp: 'asc' },
    });

    res.json({
      success: true,
      data: sensorData,
    });
  });

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
      select: { 
          id: true, 
          name: true, 
          labId: true, 
          lab: { select: { institute: true } } 
        },
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

    // Pass the full equipment object to checkAnomalies
    const equipmentInfo = {
        id: equipment.id,
        name: equipment.name,
        labId: equipment.labId,
        institute: equipment.lab.institute
    };

    // Check for anomalies (async, don't block response)
    this.checkAnomalies(equipmentInfo, req.body).catch((err) => {
      logger.error('Failed to check anomalies:', err);
    });

    broadcastEquipmentStatus(equipmentInternalId, updatedStatus);

    res.json({
      success: true,
      message: 'Equipment status updated successfully.',
      data: updatedStatus,
    });
  });

  /**
   * Checks sensor data for anomalies and creates alerts and notifications.
   * @param {object} equipment - The equipment object { id, name, labId, institute }.
   * @param {object} sensorData - The latest sensor data.
   */
  checkAnomalies = async (equipment, sensorData) => {
    try {
      const { id: equipmentId, name: equipmentName, labId, institute } = equipment;
      const alertsToCreate = [];

      // --- Anomaly Rules ---
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
      // ... (other rules)
      // --- End Anomaly Rules ---

      if (alertsToCreate.length === 0) return;

      // Find users to notify:
      // 1. All POLICY_MAKERs
      // 2. All LAB_TECHNICIANs at the specific institute
      // 3. All TRAINERs at the specific lab
      const usersToNotify = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: [
            { role: USER_ROLE_ENUM.POLICY_MAKER },
            { role: USER_ROLE_ENUM.LAB_TECHNICIAN, institute: institute },
            { role: USER_ROLE_ENUM.TRAINER, labId: labId },
          ],
        },
        select: { id: true },
      });

      const userIds = usersToNotify.map((u) => u.id);

      // Create alerts and notifications
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
            equipment: { select: { name: true, equipmentId: true, lab: { select: { name: true }} } },
          },
        });

        // Broadcast alert to all clients (clients can filter)
        broadcastAlert(newAlert);

        // Broadcast notifications to specific users
        for (const notification of newAlert.notifications) {
          broadcastNotification(notification.userId, notification);
        }
        logger.info(`Alert created and notifications sent for equipment ${equipmentId}`);
      }
    } catch (error) {
      logger.error('Check anomalies service error:', error);
    }
  };

  // --- UPDATED DASHBOARD FUNCTION ---
  getDashboardOverview = asyncHandler(async (req, res) => {
    const { role } = req.user;
    
    let data;
    if (role === USER_ROLE_ENUM.POLICY_MAKER) {
      // Policy Maker gets the centralized, high-level dashboard
      data = await getPolicyMakerDashboard();
    } else {
      // Lab Techs and Trainers get the dashboard scoped to their role
      const roleFilter = filterDataByRole(req);
      data = await getLabTechAndUserDashboard(roleFilter);
    }

    res.json({
      success: true,
      data,
    });
  });
}

export default new MonitoringController();