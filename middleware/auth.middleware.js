const jwt    = require('jsonwebtoken');
const fb     = require('../services/firebase.service');
const { jwt: jwtCfg } = require('../config/env');
const { unauthorized } = require('../utils/responseFormatter');
const logger = require('../utils/logger');

/**
 * Verifies Bearer JWT and attaches req.user.
 * Also hydrates plan/role from Firestore on each request.
 */
exports.authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return unauthorized(res, 'Authorization header missing or malformed.');
    }

    const token = header.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, jwtCfg.secret);
    } catch (e) {
      return unauthorized(res, e.name === 'TokenExpiredError'
        ? 'Access token expired.' : 'Invalid access token.');
    }

    // Hydrate fresh data from Firestore (plan changes take effect immediately)
    let userData = {};
    try {
      userData = (await fb.getDoc('users', payload.uid)) || {};
    } catch (_) { /* non-fatal */ }

    if (userData.isBanned) return unauthorized(res, 'Account suspended.');

    req.user = {
      uid:         payload.uid,
      email:       payload.email,
      role:        userData.role  || payload.role  || 'user',
      plan:        userData.plan  || 'free',
      wordsUsed:   userData.wordsUsed || 0,
      displayName: userData.displayName || '',
    };

    next();
  } catch (err) {
    logger.error('[Auth Middleware]', err);
    next(err);
  }
};

/**
 * Optional: authenticate without failing — attaches req.user if token present.
 * Used on public endpoints that behave differently when authenticated.
 */
exports.optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();

  try {
    const token   = header.split(' ')[1];
    const payload = jwt.verify(token, jwtCfg.secret);
    const userData = (await fb.getDoc('users', payload.uid)) || {};
    req.user = { uid: payload.uid, email: payload.email, plan: userData.plan || 'free', role: userData.role || 'user' };
  } catch (_) { /* ignore */ }
  next();
};
