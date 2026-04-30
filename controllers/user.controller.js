const fb     = require('../services/firebase.service');
const R      = require('../utils/responseFormatter');

// GET /api/users/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await fb.getDoc('users', req.user.uid);
    return R.success(res, user || req.user);
  } catch (err) { next(err); }
};

// PUT /api/users/me
exports.updateMe = async (req, res, next) => {
  try {
    const allowed = ['displayName', 'company', 'timezone', 'photoURL'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );
    if (!Object.keys(updates).length) return R.badRequest(res, 'No valid fields to update.');
    await fb.updateDoc('users', req.user.uid, updates);
    return R.success(res, updates, 'Profile updated.');
  } catch (err) { next(err); }
};

// DELETE /api/users/me
exports.deleteMe = async (req, res, next) => {
  try {
    await fb.deleteDoc('users', req.user.uid);
    await fb.deleteAuthUser(req.user.uid);
    return R.success(res, {}, 'Account deleted.');
  } catch (err) { next(err); }
};

// GET /api/users/me/usage
exports.getUsage = async (req, res, next) => {
  try {
    const { plans } = require('../config/env');
    const user      = await fb.getDoc('users', req.user.uid);
    const plan      = user?.plan || 'free';
    const planCfg   = plans[plan] || plans.free;
    const used      = user?.wordsUsed || 0;
    const limit     = planCfg.wordLimit;

    return R.success(res, {
      wordsUsed: used,
      wordLimit: limit === Infinity ? null : limit,
      wordsPct:  limit === Infinity ? 0 : Math.min(100, Math.round((used / limit) * 100)),
      plan,
      resetDate: user?.usageResetDate || null,
    });
  } catch (err) { next(err); }
};
