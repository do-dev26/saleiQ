const fb                 = require('./firebase.service');
const { createWidget, publicWidget } = require('../models/widget.model');
const { plans }          = require('../config/env');
const logger             = require('../utils/logger');

exports.createWidget = async (ownerId, data, userPlan = 'free') => {
  // Enforce widget count limit
  const count = await fb.count('widgets', [{ field: 'ownerId', op: '==', value: ownerId }]);
  const limit = plans[userPlan]?.widgets ?? 1;
  if (limit !== -1 && count >= limit) {
    const err = new Error(`Widget limit reached for ${userPlan} plan (max ${limit}).`);
    err.status = 403;
    throw err;
  }

  const widget = createWidget({ ...data, ownerId });
  await fb.setDoc('widgets', widget.id, widget);

  // Increment user widget count
  await fb.updateDoc('users', ownerId, { widgetCount: fb.increment(1) });

  return widget;
};

exports.getWidgets = (ownerId) =>
  fb.query('widgets', [{ field: 'ownerId', op: '==', value: ownerId }], {
    orderBy: 'createdAt', dir: 'desc',
  });

exports.getWidget = (id) => fb.getDoc('widgets', id);

exports.getPublicWidget = async (widgetId) => {
  const w = await fb.getDoc('widgets', widgetId);
  if (!w || !w.isActive) return null;
  return publicWidget(w);
};

exports.updateWidget = async (id, ownerId, updates) => {
  const widget = await fb.getDoc('widgets', id);
  if (!widget) { const e = new Error('Widget not found'); e.status = 404; throw e; }
  if (widget.ownerId !== ownerId) { const e = new Error('Forbidden'); e.status = 403; throw e; }

  const allowed = ['name', 'brainType', 'instructions', 'welcomeMessage', 'color',
                   'position', 'collectEmail', 'collectName', 'language', 'isActive'];
  const safe = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
  return fb.updateDoc('widgets', id, safe);
};

exports.deleteWidget = async (id, ownerId) => {
  const widget = await fb.getDoc('widgets', id);
  if (!widget) { const e = new Error('Widget not found'); e.status = 404; throw e; }
  if (widget.ownerId !== ownerId) { const e = new Error('Forbidden'); e.status = 403; throw e; }

  await fb.deleteDoc('widgets', id);
  await fb.updateDoc('users', ownerId, { widgetCount: fb.increment(-1) });
};

exports.incrementWidgetStats = (widgetId, field) =>
  fb.updateDoc('widgets', widgetId, { [field]: fb.increment(1) });
