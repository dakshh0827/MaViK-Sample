import express from 'express';
import reportController from '../controllers/report.controller.js';
import authMiddleware from '../middlewares/auth.js';
import { can } from '../middlewares/rbac.js';
import { 
  reportValidation, 
  dailyReportValidation, 
  weeklyReportValidation, 
  monthlyReportValidation 
} from '../middlewares/validation.js';

const router = express.Router();
router.use(authMiddleware);

// Generate standard report (existing)
router.post(
  '/generate',
  can.generateReports,
  reportValidation,
  reportController.generateReport
);

// Generate daily report
router.post(
  '/daily',
  can.generateReports,
  dailyReportValidation,
  reportController.generateDailyReport
);

// Generate weekly report
router.post(
  '/weekly',
  can.generateReports,
  weeklyReportValidation,
  reportController.generateWeeklyReport
);

// Generate monthly report
router.post(
  '/monthly',
  can.generateReports,
  monthlyReportValidation,
  reportController.generateMonthlyReport
);

// Get all reports
router.get('/', can.viewReports, reportController.getReports);

// Get a single report
router.get('/:id', can.viewReports, reportController.getReportById);

export default router;