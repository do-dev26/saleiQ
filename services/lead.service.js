const fb              = require('./firebase.service');
const { createLead }  = require('../models/lead.model');
const aiSvc           = require('./ai.service');
const widgetSvc       = require('./widget.service');
const logger          = require('../utils/logger');

/**
 * Try to detect and save a lead from a conversation.
 * Called after every chat turn — only saves if email is present.
 */
exports.detectAndSaveLead = async ({ widgetId, ownerId, sessionId, history, ipAddress, userAgent }) => {
  try {
    const transcript = history
      .map(h => `${h.role === 'user' ? 'Visitor' : 'AI'}: ${h.content}`)
      .join('\n');

    const extracted = await aiSvc.extractLeadData(transcript);

    // Only save if we have at least an email
    if (!extracted.email) return null;

    // Check if lead for this session already exists — update instead of creating duplicate
    const existing = await fb.query('leads', [
      { field: 'sessionId', op: '==', value: sessionId },
    ], { limit: 1 });

    if (existing.length) {
      await fb.updateDoc('leads', existing[0].id, {
        name:   extracted.name  || existing[0].name,
        email:  extracted.email || existing[0].email,
        phone:  extracted.phone || existing[0].phone,
        intent: extracted.intent|| existing[0].intent,
      });
      return existing[0];
    }

    const lead = createLead({
      widgetId, ownerId, sessionId,
      ...extracted,
      ipAddress, userAgent,
    });

    await fb.setDoc('leads', lead.id, lead);
    await widgetSvc.incrementWidgetStats(widgetId, 'totalLeads');
    logger.info(`[Lead] New lead saved: ${lead.email} for widget ${widgetId}`);

    return lead;
  } catch (err) {
    logger.error('[Lead] Detection error:', err.message);
    return null;
  }
};

exports.getLeads = (ownerId, { widgetId, limit = 50 } = {}) => {
  const filters = [{ field: 'ownerId', op: '==', value: ownerId }];
  if (widgetId) filters.push({ field: 'widgetId', op: '==', value: widgetId });
  return fb.query('leads', filters, { orderBy: 'createdAt', dir: 'desc', limit: Number(limit) });
};

exports.getLead = (id) => fb.getDoc('leads', id);

exports.updateLead = async (id, ownerId, updates) => {
  const lead = await fb.getDoc('leads', id);
  if (!lead) { const e = new Error('Lead not found'); e.status = 404; throw e; }
  if (lead.ownerId !== ownerId) { const e = new Error('Forbidden'); e.status = 403; throw e; }

  const allowed = ['name', 'email', 'phone', 'status', 'notes', 'tags'];
  const safe = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
  return fb.updateDoc('leads', id, safe);
};

exports.deleteLead = async (id, ownerId) => {
  const lead = await fb.getDoc('leads', id);
  if (!lead) { const e = new Error('Lead not found'); e.status = 404; throw e; }
  if (lead.ownerId !== ownerId) { const e = new Error('Forbidden'); e.status = 403; throw e; }
  await fb.deleteDoc('leads', id);
};

exports.exportLeadsCSV = async (ownerId) => {
  const { Parser } = require('json2csv');
  const leads = await exports.getLeads(ownerId, { limit: 10000 });
  const fields = ['id', 'name', 'email', 'phone', 'status', 'intent', 'widgetId', 'source', 'createdAt'];
  const parser = new Parser({ fields });
  return parser.parse(leads);
};
