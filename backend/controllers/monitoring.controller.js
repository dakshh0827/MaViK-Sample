/*
 * =====================================================
 * backend/controllers/monitoring.controller.js (FIXED)
 * =====================================================
 */
import prisma from "../config/database.js";
import logger from "../utils/logger.js";
import { filterDataByRole } from "../middlewares/rbac.js";
import {
  broadcastAlert,
  broadcastNotification,
  broadcastEquipmentStatus,
} from "../config/socketio.js";
import {
  ALERT_SEVERITY,
  ALERT_TYPE,
  NOTIFICATION_TYPE,
  USER_ROLE_ENUM,
} from "../utils/constants.js";

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
        status: { in: ["SCHEDULED", "OVERDUE"] },
        scheduledDate: { lte: sevenDaysFromNow },
        equipment: { isActive: true },
      },
    }),
    prisma.equipmentStatus.aggregate({
      _avg: { healthScore: true },
      where: { equipment: { isActive: true } },
    }),
    // FIXED: Group by instituteId instead of institute
    prisma.lab.groupBy({
      by: ["instituteId"],
      where: {
        instituteId: { not: null }, // Exclude null instituteIds
      },
      _count: {
        _all: true, // Counts number of labs
      },
      orderBy: {
        instituteId: "asc",
      },
    }),
  ]);

  // 2. Get equipment counts for each institute
  const labsWithEquipment = await prisma.lab.findMany({
    where: {
      instituteId: { not: null },
    },
    select: {
      instituteId: true,
      institute: {
        select: {
          name: true,
        },
      },
      _count: {
        select: { equipments: { where: { isActive: true } } },
      },
    },
  });

  const equipmentMap = labsWithEquipment.reduce((acc, lab) => {
    acc[lab.instituteId] = (acc[lab.instituteId] || 0) + lab._count.equipments;
    return acc;
  }, {});

  // 3. Get alert counts for each institute
  const labsWithAlerts = await prisma.lab.findMany({
    where: {
      instituteId: { not: null },
    },
    select: {
      instituteId: true,
      equipments: {
        select: {
          _count: {
            select: { alerts: { where: { isResolved: false } } },
          },
        },
      },
    },
  });

  const alertMap = labsWithAlerts.reduce((acc, lab) => {
    const alertCount = lab.equipments.reduce(
      (sum, eq) => sum + eq._count.alerts,
      0
    );
    acc[lab.instituteId] = (acc[lab.instituteId] || 0) + alertCount;
    return acc;
  }, {});

  // 4. Get institute names
  const institutes = await prisma.institute.findMany({
    where: {
      instituteId: { in: institutionData.map(i => i.instituteId) },
    },
    select: {
      instituteId: true,
      name: true,
    },
  });

  const instituteNameMap = institutes.reduce((acc, inst) => {
    acc[inst.instituteId] = inst.name;
    return acc;
  }, {});

  // 5. Combine lab counts, equipment counts, and alert counts
  const institutionsData = institutionData.map((inst) => ({
    name: instituteNameMap[inst.instituteId] || inst.instituteId,
    instituteId: inst.instituteId,
    labCount: inst._count._all,
    equipmentCount: equipmentMap[inst.instituteId] || 0,
    unresolvedAlerts: alertMap[inst.instituteId] || 0,
  }));

  return {
    overview: {
      totalInstitutions: institutionsData.length,
      totalEquipment,
      unresolvedAlerts,
      maintenanceDue,
      avgHealthScore: Math.round(avgHealthScore._avg.healthScore || 0),
    },
    institutions: institutionsData,
  };
};

/**
 * Gets the institute-specific dashboard for Lab Managers and Trainers.
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
        status: { in: ["OPERATIONAL", "IN_USE"] },
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
        status: { in: ["SCHEDULED", "OVERDUE"] },
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
            lab: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.equipmentStatus.groupBy({
      by: ["status"],
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
        lab: { 
          select: { 
            name: true, 
            instituteId: true,
            institute: {
              select: {
                name: true,
              },
            },
          } 
        },
      },
      orderBy: { name: "asc" },
    });

    res.json({
      success: true,
      data: equipmentStatus.map((eq) => ({
        id: eq.id,
        equipmentId: eq.equipmentId,
        name: eq.name,
        department: eq.department,
        labName: eq.lab.name,
        institute: eq.lab.institute?.name || eq.lab.instituteId,
        status: eq.status?.status || "OFFLINE",
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
    const { equipmentId } = req.params;
    const { hours = 24 } = req.query;
    const timeThreshold = new Date(Date.now() - hours * 60 * 60 * 1000);

    const equipment = await prisma.equipment.findUnique({
      where: { equipmentId },
      select: { id: true },
    });
    if (!equipment) {
      return res
        .status(404)
        .json({ success: false, message: "Equipment not found." });
    }

    const roleFilter = filterDataByRole(req);
    const hasAccess = await prisma.equipment.findFirst({
      where: { id: equipment.id, ...roleFilter },
    });
    if (!hasAccess) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied to this equipment." });
    }

    const sensorData = await prisma.sensorData.findMany({
      where: {
        equipmentId: equipment.id,
        timestamp: { gte: timeThreshold },
      },
      orderBy: { timestamp: "asc" },
    });

    res.json({
      success: true,
      data: sensorData,
    });
  });

  updateEquipmentStatus = asyncHandler(async (req, res) => {
    const { equipmentId } = req.params;
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
        lab: { 
          select: { 
            instituteId: true,
            institute: {
              select: {
                name: true,
              },
            },
          } 
        },
      },
    });

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found.",
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
        status: status || "OPERATIONAL",
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

    const equipmentInfo = {
      id: equipment.id,
      name: equipment.name,
      labId: equipment.labId,
      institute: equipment.lab.institute?.name || equipment.lab.instituteId,
    };

    this.checkAnomalies(equipmentInfo, req.body).catch((err) => {
      logger.error("Failed to check anomalies:", err);
    });

    broadcastEquipmentStatus(equipmentInternalId, updatedStatus);

    res.json({
      success: true,
      message: "Equipment status updated successfully.",
      data: updatedStatus,
    });
  });

  checkAnomalies = async (equipment, sensorData) => {
    try {
      const {
        id: equipmentId,
        name: equipmentName,
        labId,
        institute,
      } = equipment;
      const alertsToCreate = [];

      if (sensorData.temperature && sensorData.temperature > 80) {
        alertsToCreate.push({
          equipmentId,
          type: ALERT_TYPE.HIGH_TEMPERATURE,
          severity:
            sensorData.temperature > 100
              ? ALERT_SEVERITY.CRITICAL
              : ALERT_SEVERITY.HIGH,
          title: `High Temperature: ${equipmentName}`,
          message: `Temperature reached ${sensorData.temperature}°C.`,
        });
      }
      if (sensorData.vibration && sensorData.vibration > 10) {
        alertsToCreate.push({
          equipmentId,
          type: ALERT_TYPE.ABNORMAL_VIBRATION,
          severity:
            sensorData.vibration > 15
              ? ALERT_SEVERITY.CRITICAL
              : ALERT_SEVERITY.HIGH,
          title: `Abnormal Vibration: ${equipmentName}`,
          message: `Vibration detected at ${sensorData.vibration} mm/s.`,
        });
      }

      if (alertsToCreate.length === 0) return;

      const usersToNotify = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: [
            { role: USER_ROLE_ENUM.POLICY_MAKER },
            { role: USER_ROLE_ENUM.LAB_MANAGER, instituteId: institute },
            { role: USER_ROLE_ENUM.TRAINER, labId: labId },
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
            equipment: {
              select: {
                name: true,
                equipmentId: true,
                lab: { select: { name: true } },
              },
            },
          },
        });

        broadcastAlert(newAlert);

        for (const notification of newAlert.notifications) {
          broadcastNotification(notification.userId, notification);
        }
        logger.info(
          `Alert created and notifications sent for equipment ${equipmentId}`
        );
      }
    } catch (error) {
      logger.error("Check anomalies service error:", error);
    }
  };

  getDashboardOverview = asyncHandler(async (req, res) => {
    const { role } = req.user;

    let data;
    if (role === USER_ROLE_ENUM.POLICY_MAKER) {
      data = await getPolicyMakerDashboard();
    } else {
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