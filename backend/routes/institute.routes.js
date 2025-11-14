/*
 * =====================================================
 * backend/routes/institute.routes.js (FIXED)
 * =====================================================
 */
import express from "express";
import instituteController from "../controllers/institute.controller.js";
import authMiddleware from "../middlewares/auth.js";
import { can, isAuthenticated } from "../middlewares/rbac.js";
import { instituteValidation } from "../middlewares/validation.js";

const router = express.Router();

router.use(authMiddleware);

// Get all institutes (for all authenticated users)
router.get("/", isAuthenticated, instituteController.getAllInstitutes);

// Create institute (Policy Maker only)
router.post(
  "/",
  can.manageInstitutes,
  instituteValidation,
  instituteController.createInstitute
);

// Update institute (Policy Maker only)
router.put(
  "/:instituteId",
  can.manageInstitutes,
  instituteValidation,
  instituteController.updateInstitute
);

// Delete institute (Policy Maker only)
router.delete(
  "/:instituteId",
  can.manageInstitutes,
  instituteController.deleteInstitute
);

export default router;