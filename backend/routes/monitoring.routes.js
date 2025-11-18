// backend/routes/monitoring.routes.js (UPDATED)
import express from 'express';
import monitoringController from '../controllers/monitoring.controller.js';
import authMiddleware from '../middlewares/auth.js';
import { isAuthenticated } from '../middlewares/rbac.js';

const router = express.Router();

// This endpoint is for the IoT device, it should be secured with an API key
// For simplicity in this project, we'll keep it behind auth, but in production
// you'd have a separate middleware for API keys.
router.post('/status/:equipmentId', authMiddleware, monitoringController.updateEquipmentStatus);

// All other monitoring routes require user authentication
router.use(authMiddleware);

// Get dashboard overview
router.get('/dashboard', isAuthenticated, monitoringController.getDashboardOverview);

// Get real-time equipment status
router.get('/realtime', isAuthenticated, monitoringController.getRealtimeStatus);

// Get sensor data for specific equipment
// This uses the *string* equipmentId (e.g., "LAB-001")
router.get('/sensor/:equipmentId', isAuthenticated, monitoringController.getSensorData);

// NEW: Get comprehensive lab analytics with DepartmentAnalytics
router.get('/lab-analytics/:labId', isAuthenticated, monitoringController.getLabAnalytics);

export default router;