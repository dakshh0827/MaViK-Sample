import prisma from '../config/database.js';
import logger from '../utils/logger.js';

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class ChatbotController {
  // Send message to chatbot
  processMessage = asyncHandler(async (req, res) => {
    const { message } = req.body;
    const userId = req.user.id;

    const chatMessage = await prisma.chatMessage.create({
      data: {
        userId: userId,
        message,
      },
    });

    let response = "I'm here to help! You can ask me about 'equipment status', 'recent alerts', or 'analytics overview'.";
    let intent = 'GREETING';

    if (message.toLowerCase().includes('status')) {
      intent = 'GET_STATUS';
      response = 'Fetching real-time equipment status... (This feature is in development)';
    } else if (message.toLowerCase().includes('alert')) {
      intent = 'GET_ALERTS';
      response = 'Checking for recent unresolved alerts... (This feature is in development)';
    } else if (message.toLowerCase().includes('analytics')) {
      intent = 'GET_ANALYTICS';
      response = 'Compiling analytics overview... (This feature is in development)';
    }

    await prisma.chatMessage.update({
      where: { id: chatMessage.id },
      data: { response, intent },
    });

    logger.debug(`Chatbot message processed for user ${userId}. Intent: ${intent}`);
    res.json({ success: true, data: { message, response } });
  });

  // Get chat history
  getChatHistory = asyncHandler(async (req, res) => {
    const messages = await prisma.chatMessage.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: messages.reverse() });
  });
}

export default new ChatbotController();