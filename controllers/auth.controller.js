const jwt    = require('jsonwebtoken');
const fb     = require('../services/firebase.service');
const { createUser } = require('../models/user.model');
const { jwt: jwtCfg } = require('../config/env');
const R      = require('../utils/responseFormatter');
const logger = require('../utils/logger');

const signAccess  = (p) => jwt.sign(p, jwtCfg.secret,        { expiresIn: jwtCfg.accessTTL });
const signRefresh = (p) => jwt.sign(p, jwtCfg.refreshSecret, { expiresIn: jwtCfg.refreshTTL });

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) return R.badRequest(res, 'Email and password are required.');
    if (password.length < 8) return R.badRequest(res, 'Password must be at least 8 characters.');

    const authUser = await fb.createAuthUser({ email, password, displayName: displayName || '' });

    // Create Firestore user document
    const userDoc = createUser({ uid: authUser.uid, email, displayName: displayName || '' });
    await fb.setDoc('users', authUser.uid, userDoc);

    const access  = signAccess({ uid: authUser.uid, email, role: 'user' });
    const refresh = signRefresh({ uid: authUser.uid });

    logger.info(`[Auth] New user registered: ${email}`);
    return R.created(res, { access, refresh, user: { uid: authUser.uid, email, displayName } },
      'Account created successfully.');
  } catch (err) {
    if (err.code === 'auth/email-already-exists') return R.badRequest(res, 'Email already in use.');
    next(err);
  }
};

// POST /api/auth/login — Firebase idToken se login (frontend SDK handles password/Google)
exports.login = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return R.badRequest(res,
        'Send Firebase idToken. Password login is handled by Firebase SDK on the frontend.');
    }
    return exports.loginWithToken(req, res, next);
  } catch (err) { next(err); }
};

// POST /api/auth/login-with-token  (Firebase ID token from frontend SDK)
exports.loginWithToken = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return R.badRequest(res, 'idToken is required.');

    const decoded  = await fb.verifyIdToken(idToken);
    let userData   = await fb.getDoc('users', decoded.uid);

    // Auto-create user doc if first login (e.g. Google sign-in)
    if (!userData) {
      const userDoc = createUser({ uid: decoded.uid, email: decoded.email, displayName: decoded.name || '' });
      await fb.setDoc('users', decoded.uid, userDoc);
      userData = userDoc;
    }

    if (userData.isBanned) return R.forbidden(res, 'Account suspended.');

    const access  = signAccess({ uid: decoded.uid, email: decoded.email, role: userData.role || 'user' });
    const refresh = signRefresh({ uid: decoded.uid });

    return R.success(res, {
      access, refresh,
      user: { uid: decoded.uid, email: decoded.email, role: userData.role, plan: userData.plan, displayName: userData.displayName },
    });
  } catch (err) {
    if (err.code === 'auth/id-token-expired') return R.unauthorized(res, 'Firebase token expired.');
    next(err);
  }
};

// POST /api/auth/refresh
exports.refreshToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return R.badRequest(res, 'Refresh token is required.');

    let payload;
    try {
      payload = jwt.verify(token, jwtCfg.refreshSecret);
    } catch {
      return R.unauthorized(res, 'Invalid or expired refresh token.');
    }

    const userData = (await fb.getDoc('users', payload.uid)) || {};
    const access   = signAccess({ uid: payload.uid, email: userData.email, role: userData.role || 'user' });
    const refresh  = signRefresh({ uid: payload.uid });

    return R.success(res, { access, refresh });
  } catch (err) { next(err); }
};

// POST /api/auth/logout
exports.logout = async (req, res, next) => {
  try {
    await fb.revokeRefreshTokens(req.user.uid);
    return R.success(res, {}, 'Logged out successfully.');
  } catch (err) { next(err); }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return R.badRequest(res, 'Email is required.');

    try {
      const link = await fb.generatePasswordResetLink(email);
      // TODO: send email via your email provider (Resend, SendGrid, etc.)
      logger.info(`[Auth] Password reset link generated for ${email}: ${link}`);
    } catch (_) { /* prevent email enumeration */ }

    return R.success(res, {}, 'If that email exists, a reset link has been sent.');
  } catch (err) { next(err); }
};

// GET /api/auth/me
exports.me = async (req, res, next) => {
  try {
    const user = await fb.getDoc('users', req.user.uid);
    return R.success(res, user || req.user);
  } catch (err) { next(err); }
};
