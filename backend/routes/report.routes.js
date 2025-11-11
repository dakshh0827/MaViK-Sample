import express from 'express';
import reportController from '../controllers/report.controller.js';
import authMiddleware from '../middlewares/auth.js';
import { can } from '../middlewares/rbac.js';
import { reportValidation } from '../middlewares/validation.js';

const router = express.Router();
router.use(authMiddleware);

// Generate report
router.post(
  '/generate',
  can.generateReports,
  reportValidation,
  reportController.generateReport
);

// Get all reports
router.get('/', can.viewReports, reportController.getReports);

// Get a single report
router.get('/:id', can.viewReports, reportController.getReportById);

export default router;