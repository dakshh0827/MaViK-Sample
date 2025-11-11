import prisma from '../config/database.js';
import { filterDataByRole } from '../middlewares/rbac.js';

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class AnalyticsController {
  // Get analytics overview
  getAnalyticsOverview = asyncHandler(async (req, res) => {
    const roleFilter = filterDataByRole(req);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const analytics = await prisma.usageAnalytics.aggregate({
      where: {
        equipment: roleFilter,
        date: { gte: thirtyDaysAgo },
      },
      _avg: { utilizationRate: true, efficiency: true },
      _sum: { totalUsageHours: true, totalDowntime: true, energyConsumed: true },
    });

    const data = {
      avgUtilizationRate: analytics._avg.utilizationRate || 0,
      avgEfficiency: analytics._avg.efficiency || 0,
      totalUsageHours: analytics._sum.totalUsageHours || 0,
      totalDowntime: analytics._sum.totalDowntime || 0,
      totalEnergyConsumed: analytics._sum.energyConsumed || 0,
    };
    res.json({ success: true, data });
  });

  // Get equipment-specific analytics
  getEquipmentAnalytics = asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    const { id } = req.params; // This is the equipment's internal ID
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // We must verify the user has access to this equipment
    const roleFilter = filterDataByRole(req);
    const equipment = await prisma.equipment.findFirst({
        where: { id, ...roleFilter }
    });

    if (!equipment) {
        return res.status(404).json({ success: false, message: "Equipment not found or access denied."});
    }

    const data = await prisma.usageAnalytics.findMany({
      where: {
        equipmentId: id,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });
    res.json({ success: true, data });
  });
}

export default new AnalyticsController();