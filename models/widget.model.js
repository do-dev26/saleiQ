const { v4: uuidv4 } = require('uuid');

/**
 * Create a new widget document object.
 */
exports.createWidget = (data = {}) => {
  if (!data.ownerId || !data.name) throw new Error('ownerId and name are required');

  const now = new Date().toISOString();
  return {
    id:              uuidv4(),
    ownerId:         data.ownerId,
    name:            data.name,
    brainType:       data.brainType       || 'generic',
    persona:         data.persona         || 'sales',
    instructions:    data.instructions    || '',
    welcomeMessage:  data.welcomeMessage  || 'Hi! How can I help you today? 👋',
    color:           data.color           || '#6366f1',
    position:        data.position        || 'bottom-right',
    collectEmail:    data.collectEmail    !== false,
    collectName:     data.collectName     !== false,
    language:        data.language        || 'en',
    isActive:        true,
    totalChats:      0,
    totalLeads:      0,
    createdAt:       now,
    updatedAt:       now,
  };
};

/**
 * Public-safe widget (strips instructions — only sent to embed).
 */
exports.publicWidget = (widget = {}) => {
  const { instructions, ownerId, ...pub } = widget;
  return pub;
};
