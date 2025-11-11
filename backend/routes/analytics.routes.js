import express from 'express';
import analyticsController from '../controllers/analytics.controller.js';
import authMiddleware from '../middlewares/auth.js';
import { can } from '../middlewares/rbac.js';

const router = express.Router();
router.use(authMiddleware);

// Get analytics overview
router.get('/overview', can.viewBasicAnalytics, analyticsController.getAnalyticsOverview);

// Get equipment-specific analytics
// Note: :id here is the Equipment *internal* ID, not the string equipmentId
router.get(
  '/equipment/:id',
  can.viewDetailedAnalytics,
  analyticsController.getEquipmentAnalytics
);

export default router;