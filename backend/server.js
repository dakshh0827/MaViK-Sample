// =================== IMPORTS ===================
import dotenv from 'dotenv';
import http from 'http';
import app from './app.js'; // Import the clean app
import { initializeSocketIO } from './config/socketio.js';
import prisma from './config/database.js';
import logger from './utils/logger.js';

// =================== CONFIG ===================
dotenv.config();
const PORT = process.env.PORT || 5000;

// =================== SERVER & SOCKET SETUP ===================
const server = http.createServer(app);

// Initialize Socket.IO
initializeSocketIO(server);

// =================== START SERVER ===================
server.listen(PORT, async () => {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
    logger.info(`🌐 API URL: http://localhost:${PORT}`);
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
});

// =================== GRACEFUL SHUTDOWN ===================
const shutdown = async (signal) => {
  logger.info(`${signal} received: closing HTTP server`);
  server.close(async () => {
    logger.info('HTTP server closed');
    await prisma.$disconnect();
    logger.info('Database disconnected');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// =================== ERROR EVENTS ===================
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

export default server;