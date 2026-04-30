const { v4: uuidv4 } = require('uuid');

/**
 * Create a new lead document.
 */
exports.createLead = (data = {}) => {
  if (!data.widgetId || !data.ownerId) throw new Error('widgetId and ownerId are required');

  const now = new Date().toISOString();
  return {
    id:          uuidv4(),
    ownerId:     data.ownerId,
    widgetId:    data.widgetId,
    sessionId:   data.sessionId || uuidv4(),
    name:        data.name      || null,
    email:       data.email     || null,
    phone:       data.phone     || null,
    intent:      data.intent    || null,
    status:      'new',          // new | contacted | converted | lost
    tags:        data.tags      || [],
    notes:       '',
    source:      data.source    || 'widget',
    ipAddress:   data.ipAddress || null,
    userAgent:   data.userAgent || null,
    createdAt:   now,
    updatedAt:   now,
  };
};
