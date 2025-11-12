import express from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import labRoutes from './lab.routes.js'; // --- FIX: This line was missing ---
import equipmentRoutes from './equipment.routes.js';
import monitoringRoutes from './monitoring.routes.js';
import analyticsRoutes from './analytics.routes.js';
import alertRoutes from './alert.routes.js';
import notificationRoutes from './notification.routes.js';
import maintenanceRoutes from './maintenance.routes.js';
import reportRoutes from './report.routes.js';
import chatbotRoutes from './chatbot.routes.js';

const router = express.Router();

// API version info
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'IoT Equipment Monitoring API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      labs: '/api/labs', // --- FIX: Added to list ---
      equipment: '/api/equipment',
      monitoring: '/api/monitoring',
      analytics: '/api/analytics',
      alerts: '/api/alerts',
      notifications: '/api/notifications',
      maintenance: '/api/maintenance',
      reports: '/api/reports',
      chatbot: '/api/chatbot',
    },
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/labs', labRoutes); // --- FIX: This line was missing ---
router.use('/equipment', equipmentRoutes);
router.use('/monitoring', monitoringRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/alerts', alertRoutes);
router.use('/notifications', notificationRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/reports', reportRoutes);
router.use('/chatbot', chatbotRoutes);

export default router;