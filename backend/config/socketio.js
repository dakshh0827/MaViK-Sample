import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import { jwtConfig } from './jwt.js';
import { SOCKET_EVENTS } from '../utils/socketEvents.js';

let io;

/**
 * Initializes the Socket.IO server and authentication middleware.
 * @param {http.Server} server - The HTTP server instance.
 */
const initializeSocketIO = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error: No token provided.'));
    }

    try {
      const decoded = jwt.verify(token, jwtConfig.secret);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error.message);
      next(new Error('Authentication error: Invalid token.'));
    }
  });

  // Connection handler
  io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
    logger.info(`Client connected: ${socket.id} (User: ${socket.userId})`);

    // Join user-specific room
    socket.join(`user:${socket.userId}`);

    // Join role-based room
    socket.join(`role:${socket.userRole}`);

    // Handle equipment subscription
    socket.on(SOCKET_EVENTS.SUBSCRIBE_EQUIPMENT, (equipmentId) => {
      socket.join(`equipment:${equipmentId}`);
      logger.debug(`User ${socket.userId} subscribed to equipment ${equipmentId}`);
    });

    // Handle equipment unsubscription
    socket.on(SOCKET_EVENTS.UNSUBSCRIBE_EQUIPMENT, (equipmentId) => {
      socket.leave(`equipment:${equipmentId}`);
      logger.debug(`User ${socket.userId} unsubscribed from equipment ${equipmentId}`);
    });

    // Disconnect handler
    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });

    // Error handler
    socket.on(SOCKET_EVENTS.ERROR, (error) => {
      logger.error('Socket error:', error);
    });
  });

  logger.info('✅ Socket.IO initialized');
};

// --- Emitter Functions ---

/**
 * Emits an event to a specific user.
 * @param {string} userId - The user's ID.
 * @param {string} event - The event name.
 * @param {any} data - The data to send.
 */
const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

/**
 * Emits an event to all users with a specific role.
 * @param {string} role - The user role (e.g., 'POLICY_MAKER').
 * @param {string} event - The event name.
 * @param {any} data - The data to send.
 */
const emitToRole = (role, event, data) => {
  if (io) {
    io.to(`role:${role}`).emit(event, data);
  }
};

/**
 * Emits an event to all users subscribed to an equipment room.
 * @param {string} equipmentId - The equipment's ID.
 * @param {string} event - The event name.
 * @param {any} data - The data to send.
 */
const emitToEquipment = (equipmentId, event, data) => {
  if (io) {
    io.to(`equipment:${equipmentId}`).emit(event, data);
  }
};

/**
 * Emits an event to all connected clients.
 * @param {string} event - The event name.
 * @param {any} data - The data to send.
 */
const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

// --- Specific Broadcasters ---

/**
 * Broadcasts an equipment status update.
 * @param {string} equipmentId - The equipment's internal ID.
 * @param {object} status - The new status object.
 */
const broadcastEquipmentStatus = (equipmentId, status) => {
  emitToEquipment(equipmentId, SOCKET_EVENTS.EQUIPMENT_STATUS, status);
  emitToAll(SOCKET_EVENTS.EQUIPMENT_STATUS_UPDATE, { equipmentId, status });
};

/**
 * Broadcasts a new alert to all users.
 * @param {object} alert - The new alert object.
 */
const broadcastAlert = (alert) => {
  emitToAll(SOCKET_EVENTS.ALERT_NEW, alert);
};

/**
 * Broadcasts a new notification to a specific user.
 * @param {string} userId - The user's ID.
 * @param {object} notification - The new notification object.
 */
const broadcastNotification = (userId, notification) => {
  emitToUser(userId, SOCKET_EVENTS.NOTIFICATION_NEW, notification);
};

export {
  initializeSocketIO,
  emitToUser,
  emitToRole,
  emitToEquipment,
  emitToAll,
  broadcastEquipmentStatus,
  broadcastAlert,
  broadcastNotification,
};