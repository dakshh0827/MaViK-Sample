import express from 'express';
import chatbotController from '../controllers/chatbot.controller.js';
import authMiddleware from '../middlewares/auth.js';
import { chatbotValidation } from '../middlewares/validation.js';

const router = express.Router();
router.use(authMiddleware);

// Send message to chatbot
router.post('/message', chatbotValidation, chatbotController.processMessage);

// Get chat history
router.get('/history', chatbotController.getChatHistory);

export default router;