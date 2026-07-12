/**
 * Lightweight input validation middleware.
 * Each validator returns an Express middleware function.
 * On failure it responds 400 immediately; on success it calls next().
 */

const { badRequest } = require('../utils/responseFormatter');

// Helpers
const isEmail  = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isString = (v, min, max) => {
  if (typeof v !== 'string') return false;
  const len = v.trim().length;
  if (min !== undefined && len < min) return false;
  if (max !== undefined && len > max) return false;
  return true;
};
const isOneOf  = (v, list) => list.includes(v);

// Auth
exports.validateRegister = (req, res, next) => {
  const { email, password, displayName } = req.body;
  if (!isEmail(email))                              return badRequest(res, 'Valid email is required.');
  if (!isString(password, 8, 128))                  return badRequest(res, 'Password must be 8 to 128 characters.');
  if (displayName && !isString(displayName, 1, 80)) return badRequest(res, 'Display name too long (max 80 chars).');
  next();
};

exports.validateLogin = (req, res, next) => {
  const { idToken } = req.body;
  if (!isString(idToken, 10))                       return badRequest(res, 'idToken is required.');
  next();
};

// Widget
const VALID_BRAIN_TYPES = ['real_estate', 'saas', 'education', 'ecommerce', 'healthcare', 'generic'];
const VALID_POSITIONS   = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
const VALID_LANGUAGES   = ['en', 'hi', 'ta', 'te', 'mr', 'bn', 'gu', 'kn', 'ml', 'pa'];
const COLOR_REGEX       = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

exports.validateCreateWidget = (req, res, next) => {
  const { name, brainType, color, position, language, welcomeMessage, instructions } = req.body;
  if (!isString(name, 1, 80))                  return badRequest(res, 'Widget name is required (max 80 chars).');
  if (brainType && !isOneOf(brainType, VALID_BRAIN_TYPES))
                                               return badRequest(res, 'Invalid brainType.');
  if (color && !COLOR_REGEX.test(color))       return badRequest(res, 'color must be a valid hex code e.g. #6366f1.');
  if (position && !isOneOf(position, VALID_POSITIONS))
                                               return badRequest(res, 'Invalid position value.');
  if (language && !isOneOf(language, VALID_LANGUAGES))
                                               return badRequest(res, 'Invalid language code.');
  if (welcomeMessage && !isString(welcomeMessage, 1, 300))
                                               return badRequest(res, 'welcomeMessage max 300 chars.');
  if (instructions && !isString(instructions, 0, 2000))
                                               return badRequest(res, 'instructions max 2000 chars.');
  next();
};

exports.validateUpdateWidget = (req, res, next) => {
  const { name, brainType, color, position, language, welcomeMessage, instructions } = req.body;
  if (name !== undefined && !isString(name, 1, 80))
                                               return badRequest(res, 'Widget name must be 1 to 80 chars.');
  if (brainType && !isOneOf(brainType, VALID_BRAIN_TYPES))
                                               return badRequest(res, 'Invalid brainType.');
  if (color && !COLOR_REGEX.test(color))       return badRequest(res, 'color must be a valid hex code.');
  if (position && !isOneOf(position, VALID_POSITIONS))
                                               return badRequest(res, 'Invalid position value.');
  if (language && !isOneOf(language, VALID_LANGUAGES))
                                               return badRequest(res, 'Invalid language code.');
  if (welcomeMessage && !isString(welcomeMessage, 1, 300))
                                               return badRequest(res, 'welcomeMessage max 300 chars.');
  if (instructions !== undefined && !isString(instructions, 0, 2000))
                                               return badRequest(res, 'instructions max 2000 chars.');
  next();
};

// Business Profile
const VALID_BUSINESS_TYPES = ['real_estate', 'restaurant', 'saas', 'fno', 'ecommerce', 'healthcare', 'education', 'generic'];
const VALID_CTA_GOALS      = ['lead', 'booking', 'purchase', 'call'];
const URL_REGEX            = /^https?:\/\/.+/;

exports.validateBusinessProfile = (req, res, next) => {
  const { businessName, businessType, websiteUrl, email, phone, topProducts, ctaGoal } = req.body;
  if (businessName && !isString(businessName, 1, 120))
                                               return badRequest(res, 'businessName max 120 chars.');
  if (businessType && !isOneOf(businessType, VALID_BUSINESS_TYPES))
                                               return badRequest(res, 'Invalid businessType.');
  if (websiteUrl && !URL_REGEX.test(websiteUrl))
                                               return badRequest(res, 'websiteUrl must start with http or https.');
  if (email && !isEmail(email))                return badRequest(res, 'Invalid business email.');
  if (phone && !isString(phone, 5, 20))        return badRequest(res, 'Invalid phone number.');
  if (topProducts !== undefined) {
    if (!Array.isArray(topProducts))           return badRequest(res, 'topProducts must be an array.');
    if (topProducts.length > 5)               return badRequest(res, 'Maximum 5 products/services allowed.');
    for (const p of topProducts) {
      if (!p.name || !isString(p.name, 1, 80)) return badRequest(res, 'Each product must have a name (max 80 chars).');
    }
  }
  if (ctaGoal && !isOneOf(ctaGoal, VALID_CTA_GOALS))
                                               return badRequest(res, 'Invalid ctaGoal value.');
  next();
};

// Chat
exports.validateChat = (req, res, next) => {
  const { message, history } = req.body;
  if (!isString(message, 1, 2000))             return badRequest(res, 'message is required (max 2000 chars).');
  if (history !== undefined && !Array.isArray(history))
                                               return badRequest(res, 'history must be an array.');
  next();
};

// Lead
const VALID_LEAD_STATUSES = ['new', 'contacted', 'converted', 'lost'];

exports.validateUpdateLead = (req, res, next) => {
  const { email, status, name, notes } = req.body;
  if (email  && !isEmail(email))               return badRequest(res, 'Invalid email.');
  if (status && !isOneOf(status, VALID_LEAD_STATUSES))
                                               return badRequest(res, 'Invalid status value.');
  if (name   && !isString(name, 1, 120))       return badRequest(res, 'name max 120 chars.');
  if (notes  && !isString(notes, 0, 2000))     return badRequest(res, 'notes max 2000 chars.');
  next();
};
