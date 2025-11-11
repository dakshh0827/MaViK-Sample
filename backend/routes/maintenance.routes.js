import express from 'express';
import maintenanceController from '../controllers/maintenance.controller.js';
import authMiddleware from '../middlewares/auth.js';
import { can } from '../middlewares/rbac.js';
import { maintenanceLogValidation } from '../middlewares/validation.js';

const router = express.Router();
router.use(authMiddleware);

// Get maintenance logs
router.get('/', can.viewMaintenance, maintenanceController.getMaintenanceLogs);

// Create maintenance log
router.post(
  '/',
  can.manageMaintenance,
  maintenanceLogValidation,
  maintenanceController.createMaintenanceLog
);

// Update maintenance log
router.put(
  '/:id',
  can.manageMaintenance,
  maintenanceController.updateMaintenanceLog
);

export default router;