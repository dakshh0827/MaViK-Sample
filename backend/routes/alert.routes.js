import express from 'express';
import alertController from '../controllers/alert.controller.js';
import authMiddleware from '../middlewares/auth.js';
import { can } from '../middlewares/rbac.js';

const router = express.Router();
router.use(authMiddleware);

// Get all alerts
router.get('/', can.viewAlerts, alertController.getAllAlerts);

// Resolve alert
router.put('/:id/resolve', can.manageAlerts, alertController.resolveAlert);

export default router;