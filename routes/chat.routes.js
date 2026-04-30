const router = require('express').Router();
const ctrl   = require('../controllers/chat.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { chat: chatLimit } = require('../middleware/rateLimit.middleware');

// Public — widget visitors chat here (no auth required)
router.post('/:widgetId', chatLimit, ctrl.chat);

// Protected — dashboard conversation history
router.get('/:widgetId/history/:sessionId', authenticate, ctrl.getHistory);

module.exports = router;
