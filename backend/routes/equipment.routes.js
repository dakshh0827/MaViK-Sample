import express from 'express';
import equipmentController from '../controllers/equipment.controller.js';
import authMiddleware from '../middlewares/auth.js';
import { can } from '../middlewares/rbac.js';

const router = express.Router();

// All equipment routes require authentication
router.use(authMiddleware);

// Get all equipment (all roles)
router.get('/', can.viewEquipment, equipmentController.getAllEquipment);

// Get equipment statistics (all roles)
router.get('/stats', can.viewEquipment, equipmentController.getEquipmentStats);

// Get equipment by ID (all roles)
router.get('/:id', can.viewEquipment, equipmentController.getEquipmentById);

// Create new equipment (POLICY_MAKER, LAB_TECHNICIAN)
router.post('/', can.manageEquipment, equipmentController.createEquipment);

// Update equipment (POLICY_MAKER, LAB_TECHNICIAN)
router.put('/:id', can.manageEquipment, equipmentController.updateEquipment);

// Delete equipment (POLICY_MAKER, LAB_TECHNICIAN)
router.delete('/:id', can.manageEquipment, equipmentController.deleteEquipment);

export default router;