import express from 'express';
import labController from '../controllers/lab.controller.js';
import authMiddleware from '../middlewares/auth.js';
import { can } from '../middlewares/rbac.js';
import { labValidation } from '../middlewares/validation.js';

const router = express.Router();
router.use(authMiddleware);

// Policy Makers can create, update, delete labs.
router.post(
  '/',
  can.manageLabs,
  labValidation,
  labController.createLab
);

// Routes now use the public :labId string
router.put(
  '/:labId',
  can.manageLabs,
  labValidation,
  labController.updateLab
);
router.delete(
  '/:labId',
  can.manageLabs,
  labController.deleteLab
);

// Lab Techs and Policy Makers can view labs.
router.get(
  '/',
  can.viewLabs,
  labController.getAllLabs
);

// Route now uses the public :labId string
router.get(
  '/:labId',
  can.viewLabs,
  labController.getLabById
);

export default router;