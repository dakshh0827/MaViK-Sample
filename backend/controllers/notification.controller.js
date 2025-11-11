import prisma from '../config/database.js';
import logger from '../utils/logger.js';

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class NotificationController {
  // Get user notifications
  getNotifications = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, isRead } = req.query;
    const skip = (page - 1) * limit;
    const userId = req.user.id;

    const where = {
      userId: userId,
      ...(isRead !== undefined && { isRead: isRead === 'true' }),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          alert: {
            include: {
              equipment: { select: { name: true, equipmentId: true } },
            },
          },
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId: userId, isRead: false },
      }),
    ]);

    res.json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // Mark as read
  markAsRead = asyncHandler(async (req, res) => {
    try {
      await prisma.notification.update({
        where: { id: req.params.id, userId: req.user.id },
        data: { isRead: true },
      });
      logger.debug(`Notification ${req.params.id} marked as read for user ${req.user.id}`);
      res.json({ success: true, message: 'Notification marked as read.' });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ success: false, message: 'Notification not found or access denied.' });
      }
      throw error;
    }
  });

  // Mark all as read
  markAllAsRead = asyncHandler(async (req, res) => {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    logger.info(`All notifications marked as read for user ${req.user.id}. Count: ${result.count}`);
    res.json({ success: true, message: `All ${result.count} notifications marked as read.` });
  });
}

export default new NotificationController();