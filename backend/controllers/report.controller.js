import prisma from '../config/database.js';
import logger from '../utils/logger.js';
import { filterDataByRole } from '../middlewares/rbac.js';

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class ReportController {
  // Generate report
  generateReport = asyncHandler(async (req, res) => {
    const { reportType, dateFrom, dateTo, title } = req.body;
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const roleFilter = filterDataByRole(req);

    const equipmentWhere = {
      equipment: {
        ...roleFilter,
        isActive: true,
      },
    };

    let data = {};

    switch (reportType) {
      case 'MAINTENANCE_HISTORY':
        data = await prisma.maintenanceLog.findMany({
          where: {
            ...equipmentWhere,
            completedDate: { gte: from, lte: to },
          },
          include: {
            equipment: { select: { name: true, equipmentId: true, institute: true } },
            technician: { select: { firstName: true, lastName: true, email: true } },
          },
          orderBy: { completedDate: 'desc' },
        });
        break;
      case 'ALERT_HISTORY':
        data = await prisma.alert.findMany({
          where: {
            ...equipmentWhere,
            createdAt: { gte: from, lte: to },
          },
          include: {
            equipment: { select: { name: true, equipmentId: true, institute: true } },
          },
          orderBy: { createdAt: 'desc' },
        });
        break;
      case 'USAGE_ANALYTICS':
        data = await prisma.usageAnalytics.findMany({
          where: {
            ...equipmentWhere,
            date: { gte: from, lte: to },
          },
          include: {
            equipment: { select: { name: true, equipmentId: true, institute: true } },
          },
          orderBy: { date: 'asc' },
        });
        break;
      default:
        data = { message: 'Report type not yet implemented.' };
    }

    const report = await prisma.report.create({
      data: {
        reportType,
        title: title || `${reportType} Report (${from.toLocaleDateString()} - ${to.toLocaleDateString()})`,
        dateFrom: from,
        dateTo: to,
        generatedBy: req.user.id,
        data: data,
      },
    });

    logger.info(`Report generated: ${report.id} by ${req.user.email}`);
    res.status(201).json({
      success: true,
      message: 'Report generated successfully.',
      data: report,
    });
  });

  // Get all reports
  getReports = asyncHandler(async (req, res) => {
    const roleFilter = (req.user.role === 'POLICY_MAKER') ? {} : { generatedBy: req.user.id };
    const reports = await prisma.report.findMany({
      where: roleFilter,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: reports });
  });

  // Get a single report
  getReportById = asyncHandler(async (req, res) => {
    const report = await prisma.report.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    if (req.user.role !== 'POLICY_MAKER' && report.generatedBy !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.json({ success: true, data: report });
  });
}

export default new ReportController();