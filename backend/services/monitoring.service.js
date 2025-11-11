// import prisma from '../config/database.js';
// import logger from '../utils/logger.js';
// import {
//   broadcastAlert,
//   broadcastNotification,
//   broadcastEquipmentStatus,
// } from '../config/socketio.js';
// import { ALERT_SEVERITY, ALERT_TYPE, NOTIFICATION_TYPE } from '../utils/constants.js';

// class MonitoringService {
//   /**
//    * Gets the real-time status of all equipment.
//    * @param {object} roleFilter - RBAC filter from middleware.
//    * @returns {Array<object>} List of equipment statuses.
//    */
//   async getRealtimeStatus(roleFilter) {
//     const equipmentStatus = await prisma.equipment.findMany({
//       where: { ...roleFilter, isActive: true },
//       include: {
//         status: true,
//       },
//       orderBy: { name: 'asc' },
//     });

//     return equipmentStatus.map((eq) => ({
//       id: eq.id,
//       equipmentId: eq.equipmentId,
//       name: eq.name,
//       department: eq.department,
//       location: eq.location,
//       status: eq.status?.status || 'OFFLINE',
//       healthScore: eq.status?.healthScore || 0,
//       temperature: eq.status?.temperature,
//       vibration: eq.status?.vibration,
//       energyConsumption: eq.status?.energyConsumption,
//       lastUsedAt: eq.status?.lastUsedAt,
//       updatedAt: eq.status?.updatedAt,
//     }));
//   }

//   /**
//    * Gets time-series sensor data for a specific equipment.
//    * @param {string} equipmentStringId - The equipment's public string ID (e.g., "LAB-001").
//    * @param {number} hours - The number of hours to look back.
//    * @returns {Array<object>} List of sensor data points.
//    */
//   async getSensorData(equipmentStringId, hours = 24) {
//     const timeThreshold = new Date(Date.now() - hours * 60 * 60 * 1000);

//     // Find the equipment's internal ID
//     const equipment = await prisma.equipment.findUnique({
//       where: { equipmentId: equipmentStringId },
//       select: { id: true },
//     });

//     if (!equipment) {
//       const error = new Error('Equipment not found.');
//       error.statusCode = 404;
//       throw error;
//     }

//     const sensorData = await prisma.sensorData.findMany({
//       where: {
//         equipmentId: equipment.id,
//         timestamp: { gte: timeThreshold },
//       },
//       orderBy: { timestamp: 'asc' },
//     });

//     return sensorData;
//   }

//   /**
//    * Updates equipment status from an IoT device.
//    * @param {string} equipmentStringId - The equipment's public string ID.
//    * @param {object} statusData - The new sensor/status data.
//    * @returns {object} The updated equipment status.
//    */
//   async updateEquipmentStatus(equipmentStringId, statusData) {
//     const {
//       status,
//       temperature,
//       vibration,
//       energyConsumption,
//       pressure,
//       humidity,
//       rpm,
//       voltage,
//       current,
//     } = statusData;

//     // Find equipment by its string ID
//     const equipment = await prisma.equipment.findFirst({
//       where: { equipmentId: equipmentStringId },
//       select: { id: true, institute: true, name: true },
//     });

//     if (!equipment) {
//       const error = new Error('Equipment not found.');
//       error.statusCode = 404;
//       throw error;
//     }

//     const equipmentInternalId = equipment.id;

//     // 1. Upsert equipment status
//     const updatedStatus = await prisma.equipmentStatus.upsert({
//       where: { equipmentId: equipmentInternalId },
//       update: {
//         ...(status && { status }),
//         ...(temperature !== undefined && { temperature }),
//         ...(vibration !== undefined && { vibration }),
//         ...(energyConsumption !== undefined && { energyConsumption }),
//         lastUsedAt: new Date(),
//       },
//       create: {
//         equipmentId: equipmentInternalId,
//         status: status || 'OPERATIONAL',
//         temperature,
//         vibration,
//         energyConsumption,
//       },
//     });

//     // 2. Store raw sensor data
//     await prisma.sensorData.create({
//       data: {
//         equipmentId: equipmentInternalId,
//         temperature,
//         vibration,
//         energyConsumption,
//         pressure,
//         humidity,
//         rpm,
//         voltage,
//         current,
//       },
//     });

//     // 3. Check for anomalies and create alerts (async, don't block response)
//     this.checkAnomalies(equipment, statusData).catch((err) => {
//       logger.error('Failed to check anomalies:', err);
//     });

//     // 4. Broadcast status update via WebSocket
//     broadcastEquipmentStatus(equipmentInternalId, updatedStatus);

//     return updatedStatus;
//   }

//   /**
//    * Checks sensor data for anomalies and creates alerts and notifications.
//    * @param {object} equipment - The equipment object { id, institute, name }.
//    * @param {object} sensorData - The latest sensor data.
//    */
//   async checkAnomalies(equipment, sensorData) {
//     try {
//       const { id: equipmentId, institute, name: equipmentName } = equipment;
//       const alertsToCreate = [];

//       // --- Anomaly Rules ---
//       // Rule 1: Temperature
//       if (sensorData.temperature && sensorData.temperature > 80) {
//         alertsToCreate.push({
//           equipmentId,
//           type: ALERT_TYPE.HIGH_TEMPERATURE,
//           severity: sensorData.temperature > 100 ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.HIGH,
//           title: `High Temperature: ${equipmentName}`,
//           message: `Temperature reached ${sensorData.temperature}°C.`,
//         });
//       }
//       // Rule 2: Vibration
//       if (sensorData.vibration && sensorData.vibration > 10) {
//         alertsToCreate.push({
//           equipmentId,
//           type: ALERT_TYPE.ABNORMAL_VIBRATION,
//           severity: sensorData.vibration > 15 ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.HIGH,
//           title: `Abnormal Vibration: ${equipmentName}`,
//           message: `Vibration detected at ${sensorData.vibration} mm/s.`,
//         });
//       }
//       // Rule 3: Energy Consumption
//       if (sensorData.energyConsumption && sensorData.energyConsumption > 50) {
//         alertsToCreate.push({
//           equipmentId,
//           type: ALERT_TYPE.HIGH_ENERGY_CONSUMPTION,
//           severity: ALERT_SEVERITY.MEDIUM,
//           title: `High Energy Use: ${equipmentName}`,
//           message: `Energy consumption spiked to ${sensorData.energyConsumption} kWh.`,
//         });
//       }
//       // --- End Anomaly Rules ---

//       if (alertsToCreate.length === 0) {
//         return; // No anomalies
//       }

//       // Find users to notify:
//       // - All POLICY_MAKERs
//       // - LAB_TECHNICIANs at the specific institute
//       const usersToNotify = await prisma.user.findMany({
//         where: {
//           isActive: true,
//           OR: [
//             { role: 'POLICY_MAKER' },
//             { role: 'LAB_TECHNICIAN', institute: institute },
//           ],
//         },
//         select: { id: true },
//       });

//       const userIds = usersToNotify.map((u) => u.id);

//       // Create alerts and notifications in a transaction
//       for (const alertData of alertsToCreate) {
//         const newAlert = await prisma.alert.create({
//           data: {
//             ...alertData,
//             // Create notifications for all relevant users
//             notifications: {
//               create: userIds.map((userId) => ({
//                 userId: userId,
//                 title: alertData.title,
//                 message: alertData.message,
//                 type: NOTIFICATION_TYPE.ALERT,
//               })),
//             },
//           },
//           include: {
//             notifications: true, // Include the created notifications
//             equipment: { select: { name: true, equipmentId: true } },
//           },
//         });

//         // Broadcast alert to all clients
//         broadcastAlert(newAlert);

//         // Broadcast notifications to specific users
//         for (const notification of newAlert.notifications) {
//           broadcastNotification(notification.userId, notification);
//         }

//         logger.info(`Alert created and notifications sent for equipment ${equipmentId}`);
//       }
//     } catch (error) {
//       logger.error('Check anomalies service error:', error);
//     }
//   }

//   /**
//    * Gets overview statistics for the dashboard.
//    * @param {object} roleFilter - RBAC filter from middleware.
//    * @returns {object} Dashboard data.
//    */
//   async getDashboardOverview(roleFilter) {
//     const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

//     const [
//       totalEquipment,
//       activeEquipment,
//       unresolvedAlerts,
//       maintenanceDue,
//       avgHealthScore,
//       recentAlerts,
//       equipmentByStatus,
//     ] = await Promise.all([
//       prisma.equipment.count({ where: { ...roleFilter, isActive: true } }),
//       prisma.equipmentStatus.count({
//         where: {
//           status: { in: ['OPERATIONAL', 'IN_USE'] },
//           equipment: { ...roleFilter, isActive: true },
//         },
//       }),
//       prisma.alert.count({
//         where: {
//           isResolved: false,
//           equipment: roleFilter,
//         },
//       }),
//       prisma.maintenanceLog.count({
//         where: {
//           status: { in: ['SCHEDULED', 'OVERDUE'] },
//           scheduledDate: { lte: sevenDaysFromNow },
//           equipment: { ...roleFilter, isActive: true },
//         },
//       }),
//       prisma.equipmentStatus.aggregate({
//         _avg: { healthScore: true },
//         where: { equipment: { ...roleFilter, isActive: true } },
//       }),
//       prisma.alert.findMany({
//         where: {
//           isResolved: false,
//           equipment: roleFilter,
//         },
//         include: {
//           equipment: {
//             select: {
//               equipmentId: true,
//               name: true,
//             },
//           },
//         },
//         orderBy: { createdAt: 'desc' },
//         take: 5,
//       }),
//       prisma.equipmentStatus.groupBy({
//         by: ['status'],
//         where: { equipment: { ...roleFilter, isActive: true } },
//         _count: true,
//       }),
//     ]);

//     return {
//       overview: {
//         totalEquipment,
//         activeEquipment,
//         unresolvedAlerts,
//         maintenanceDue,
//         avgHealthScore: Math.round(avgHealthScore._avg.healthScore || 0),
//       },
//       recentAlerts,
//       equipmentByStatus: equipmentByStatus.map((s) => ({
//         status: s.status,
//         count: s._count,
//       })),
//     };
//   }
// }

// export default new MonitoringService();