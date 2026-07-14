const fb     = require('./firebase.service');
const { plans } = require('../config/env');

exports.getSummary = async (uid, userPlan = 'free') => {
  const [widgets, leads, chats, user] = await Promise.all([
    fb.count('widgets',       [{ field: 'ownerId', op: '==', value: uid }]),
    fb.count('leads',         [{ field: 'ownerId', op: '==', value: uid }]),
    fb.count('conversations', [{ field: 'ownerId', op: '==', value: uid }]),
    fb.getDoc('users', uid),
  ]);

  const planCfg   = plans[userPlan] || plans.free;
  const wordsUsed = user?.wordsUsed || 0;

  return {
    totalWidgets:      widgets,
    totalLeads:        leads,
    totalChats:        chats,
    wordsUsed,
    wordLimit:         planCfg.wordLimit === Infinity ? null : planCfg.wordLimit,
    wordUsagePct:      planCfg.wordLimit === Infinity ? 0
                         : Math.min(100, Math.round((wordsUsed / planCfg.wordLimit) * 100)),
    plan:              userPlan,
    usageResetDate:    user?.usageResetDate || null,
  };
};

exports.getWidgetAnalytics = async (widgetId, ownerId, days = 30) => {
  const widget = await fb.getDoc('widgets', widgetId);
  if (!widget || widget.ownerId !== ownerId) {
    const e = new Error('Forbidden'); e.status = 403; throw e;
  }

  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [convos, leads] = await Promise.all([
    fb.query('conversations', [
      { field: 'widgetId', op: '==', value: widgetId },
      { field: 'createdAt', op: '>=', value: since },
    ]),
    fb.count('leads', [
      { field: 'widgetId', op: '==', value: widgetId },
      { field: 'createdAt', op: '>=', value: since },
    ]),
  ]);

  // Group by day
  const byDay = {};
  for (const c of convos) {
    const day = (c.createdAt || '').slice(0, 10);
    if (day) byDay[day] = (byDay[day] || 0) + 1;
  }

  return {
    widgetId,
    widgetName:         widget.name,
    period:             `${days}d`,
    totalChats:         convos.length,
    totalLeads:         leads,
    conversionRate:     convos.length ? `${Math.round((leads / convos.length) * 100)}%` : '0%',
    dailyBreakdown:     byDay,
  };
};

exports.getLeadAnalytics = async (ownerId) => {
  const leads = await fb.query('leads', [{ field: 'ownerId', op: '==', value: ownerId }]);

  const byWidget = {};
  const byStatus = {};
  for (const l of leads) {
    byWidget[l.widgetId] = (byWidget[l.widgetId] || 0) + 1;
    byStatus[l.status]   = (byStatus[l.status]   || 0) + 1;
  }

  return { total: leads.length, byWidget, byStatus };
};

exports.getConversationStats = async (ownerId, days = 30) => {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const convos = await fb.query('conversations', [
    { field: 'ownerId',    op: '==', value: ownerId },
    { field: 'createdAt',  op: '>=', value: since },
  ]);

  const sessions   = new Set(convos.map(c => c.sessionId)).size;
  const totalWords = convos.reduce((s, c) => s + (c.wordCount || 0), 0);

  return {
    period:           `${days}d`,
    totalChats:       convos.length,
    uniqueSessions:   sessions,
    totalWords,
    avgWordsPerChat:  convos.length ? Math.round(totalWords / convos.length) : 0,
  };
};

// GET sessions list for a widget — used by Conversations dashboard page
exports.getWidgetSessions = async (ownerId, widgetId, days = 90) => {
  const filters = [
    { field: 'ownerId',  op: '==', value: ownerId },
  ];
  if (widgetId) filters.push({ field: 'widgetId', op: '==', value: widgetId });
  if (days) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    filters.push({ field: 'createdAt', op: '>=', value: since });
  }

  const convos = await fb.query('conversations', filters, { orderBy: 'createdAt', dir: 'desc', limit: 500 });

  // Group by sessionId — return one row per session
  const sessionMap = {};
  for (const c of convos) {
    const sid = c.sessionId;
    if (!sid) continue;
    if (!sessionMap[sid]) {
      sessionMap[sid] = {
        sessionId:   sid,
        widgetId:    c.widgetId,
        lastMessage: c.userMessage?.slice(0, 100),
        lastAt:      c.createdAt,
        turnCount:   0,
      };
    }
    sessionMap[sid].turnCount++;
    // Keep the most recent message as preview
    if (c.createdAt > sessionMap[sid].lastAt) {
      sessionMap[sid].lastAt      = c.createdAt;
      sessionMap[sid].lastMessage = c.userMessage?.slice(0, 100);
    }
  }

  return Object.values(sessionMap).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
};
