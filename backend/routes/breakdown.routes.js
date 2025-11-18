/*
 * =====================================================
 * backend/routes/breakdown.routes.js
 * =====================================================
 */
import express from "express";
import breakdownController from "../controllers/breakdown.controller.js";
import authMiddleware from "../middlewares/auth.js";
import { can } from "../middlewares/rbac.js";

const router = express.Router();

// All breakdown routes require authentication
router.use(authMiddleware);

// Get all breakdown equipment (LAB_MANAGER and POLICY_MAKER)
router.get("/", can.manageEquipment, breakdownController.getBreakdownEquipment);

// Respond to breakdown alert (Yes/No) - LAB_MANAGER
router.post(
  "/alert/:alertId/respond",
  can.manageEquipment,
  breakdownController.respondToBreakdownAlert
);

// Manually add equipment to breakdown list - LAB_MANAGER
router.post(
  "/add",
  can.manageEquipment,
  breakdownController.addBreakdownEquipment
);

// Submit reorder request - LAB_MANAGER
router.post(
  "/:breakdownId/reorder",
  can.manageEquipment,
  breakdownController.submitReorderRequest
);

// Mark breakdown as resolved - LAB_MANAGER
router.patch(
  "/:breakdownId/resolve",
  can.manageEquipment,
  breakdownController.resolveBreakdown
);

// === POLICY_MAKER ONLY ROUTES ===

// Get all reorder requests
router.get(
  "/reorders",
  can.manageLabs, // Only POLICY_MAKER
  breakdownController.getReorderRequests
);

// Review reorder request (Approve/Reject)
router.post(
  "/reorders/:requestId/review",
  can.manageLabs, // Only POLICY_MAKER
  breakdownController.reviewReorderRequest
);

export default router;
