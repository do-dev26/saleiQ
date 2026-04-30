const aiSvc        = require('../services/ai.service');
const leadSvc      = require('../services/lead.service');
const widgetSvc    = require('../services/widget.service');
const businessSvc  = require('../services/business.service');
const fb           = require('../services/firebase.service');
const { countWords } = require('../utils/wordCounter');
const R            = require('../utils/responseFormatter');
const logger       = require('../utils/logger');
const { v4: uuid } = require('uuid');

/**
 * POST /api/chat/:widgetId
 * Public endpoint — identified by widgetId.
 * Business profile is auto-loaded and injected into AI context.
 */
exports.chat = async (req, res, next) => {
  try {
    const { widgetId } = req.params;
    const { message, sessionId, history = [] } = req.body;

    if (!message?.trim()) return R.badRequest(res, 'Message is required.');
    if (message.length > 2000) return R.badRequest(res, 'Message too long (max 2000 chars).');

    // Load widget
    const widget = await widgetSvc.getWidget(widgetId);
    if (!widget || !widget.isActive) return R.notFound(res, 'Widget not found or inactive.');

    // Load owner — check plan/usage/ban
    const owner = await fb.getDoc('users', widget.ownerId);
    if (!owner || owner.isBanned) {
      return R.error(res, 'This widget is currently unavailable.', 503);
    }

    // Check word limit
    const { plans } = require('../config/env');
    const planCfg   = plans[owner.plan || 'free'] || plans.free;
    const wordLimit = planCfg.wordLimit;
    const wordsUsed = owner.wordsUsed || 0;

    if (wordLimit !== Infinity && wordsUsed >= wordLimit) {
      return R.error(res,
        'This widget has reached its monthly limit. Please contact the website owner.', 429);
    }

    const sid = sessionId || uuid();

    // Load business profile context (non-blocking if fails)
    let businessContext = '';
    try {
      businessContext = await businessSvc.getAIContext(widgetId);
    } catch (e) {
      logger.warn('[Chat] Business context load failed (non-fatal):', e.message);
    }

    // Build full system prompt = brain + business context + custom instructions
    const systemPrompt = [
      widget.instructions || '',
      businessContext,
    ].filter(Boolean).join('\n\n');

    // Call AI with full context
    const aiReply = await aiSvc.chat({
      brainType:    widget.brainType || 'generic',
      systemPrompt,
      history:      history.slice(-10),
      userMessage:  message,
    });

    const newWordCount = countWords(message) + countWords(aiReply.content);

    // Persist conversation
    await fb.addDoc('conversations', {
      widgetId,
      ownerId:     widget.ownerId,
      sessionId:   sid,
      userMessage: message,
      aiReply:     aiReply.content,
      wordCount:   newWordCount,
      tokens:      aiReply.totalTokens,
      createdAt:   new Date().toISOString(),
    });

    // Increment usage
    await fb.updateDoc('users', widget.ownerId, {
      wordsUsed: fb.increment(newWordCount),
    });

    // Increment widget chat count
    await widgetSvc.incrementWidgetStats(widgetId, 'totalChats');

    // Detect and save lead (non-blocking)
    const updatedHistory = [
      ...history,
      { role: 'user',      content: message },
      { role: 'assistant', content: aiReply.content },
    ];
    leadSvc.detectAndSaveLead({
      widgetId,
      ownerId:   widget.ownerId,
      sessionId: sid,
      history:   updatedHistory,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(e => logger.error('[Chat] Lead detection failed:', e.message));

    return R.success(res, {
      reply:     aiReply.content,
      sessionId: sid,
    });
  } catch (err) {
    logger.error('[Chat] Error:', err.message);
    next(err);
  }
};

/**
 * GET /api/chat/:widgetId/history/:sessionId
 */
exports.getHistory = async (req, res, next) => {
  try {
    const { widgetId, sessionId } = req.params;
    const widget = await widgetSvc.getWidget(widgetId);
    if (!widget || widget.ownerId !== req.user.uid) return R.forbidden(res);

    const turns = await fb.query('conversations', [
      { field: 'widgetId',  op: '==', value: widgetId },
      { field: 'sessionId', op: '==', value: sessionId },
    ], { orderBy: 'createdAt', dir: 'asc' });

    return R.success(res, turns);
  } catch (err) { next(err); }
};
