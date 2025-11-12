// =================== IMPORTS ===================
import dotenv from 'dotenv';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import passport from './config/passport.js';
import { initializeSocketIO } from './config/socketio.js';
import prisma from './config/database.js';
import logger from './utils/logger.js';
import { apiLimiter } from './middlewares/rateLimiter.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';

// =================== CONFIG ===================
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// =================== MIDDLEWARES ===================

// Security
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Session (for OAuth or user sessions)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Passport (Auth Middleware)
app.use(passport.initialize());
app.use(passport.session());

// Rate Limiter
app.use('/api', apiLimiter);

// =================== ROUTES ===================

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

// Core routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// =================== ERROR HANDLERS ===================

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(err.stack);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

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
