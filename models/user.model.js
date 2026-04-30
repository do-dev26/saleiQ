/**
 * User Model — defines the shape of a user document in Firestore.
 * Use createUser() to create a validated object before writing to DB.
 */

const { v4: uuidv4 } = require('uuid');

const DEFAULTS = {
  plan:             'free',
  role:             'user',
  wordsUsed:        0,
  widgetCount:      0,
  stripeCustomerId: null,
  subscriptionId:   null,
  subscriptionStatus: 'inactive',
  isActive:         true,
  isBanned:         false,
  displayName:      '',
  company:          '',
  timezone:         'UTC',
  usageResetDate:   null,
};

/**
 * Create a new user document object.
 * @param {object} data - Partial user data (uid and email required)
 */
exports.createUser = (data = {}) => {
  if (!data.uid || !data.email) throw new Error('uid and email are required');

  const now = new Date().toISOString();
  return {
    ...DEFAULTS,
    ...data,
    uid:            data.uid,
    email:          data.email,
    id:             data.uid,
    usageResetDate: new Date(new Date().setDate(1) + 30 * 86400000).toISOString(),
    createdAt:      now,
    updatedAt:      now,
  };
};

/**
 * Sanitise user before sending to client — strips sensitive fields.
 */
exports.sanitizeUser = (user = {}) => {
  const { stripeCustomerId, subscriptionId, isBanned, ...safe } = user;
  return safe;
};

exports.PLAN_HIERARCHY = ['free', 'starter', 'pro', 'enterprise'];
