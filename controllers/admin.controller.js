const fb          = require('../services/firebase.service');
const billingSvc  = require('../services/billing.service');
const R           = require('../utils/responseFormatter');
const logger      = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM STATS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/stats
exports.getPlatformStats = async (req, res, next) => {
  try {
    const { plans } = require('../config/env');

    const [totalUsers, totalWidgets, totalLeads, totalConversations] = await Promise.all([
      fb.count('users',         []),
      fb.count('widgets',       []),
      fb.count('leads',         []),
      fb.count('conversations', []),
    ]);

    // Users per plan
    const planCounts = {};
    for (const plan of Object.keys(plans)) {
      planCounts[plan] = await fb.count('users', [{ field: 'plan', op: '==', value: plan }]);
    }

    // Active widgets (isActive = true)
    const activeWidgets = await fb.count('widgets', [{ field: 'isActive', op: '==', value: true }]);

    // New users in last 30 days
    const since30d = new Date(Date.now() - 30 * 86400000).toISOString();
    const newUsers30d = await fb.count('users', [{ field: 'createdAt', op: '>=', value: since30d }]);

    // New leads in last 30 days
    const newLeads30d = await fb.count('leads', [{ field: 'createdAt', op: '>=', value: since30d }]);

    // Banned users
    const bannedUsers = await fb.count('users', [{ field: 'isBanned', op: '==', value: true }]);

    return R.success(res, {
      overview: {
        totalUsers,
        totalWidgets,
        activeWidgets,
        totalLeads,
        totalConversations,
        bannedUsers,
      },
      growth: {
        newUsers30d,
        newLeads30d,
      },
      planBreakdown: planCounts,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/users?limit=50&cursor=xxx&plan=pro&banned=false
exports.listUsers = async (req, res, next) => {
  try {
    const { limit = 50, cursor, plan, banned, search } = req.query;

    // Build filters
    const filters = [];
    if (plan)   filters.push({ field: 'plan',     op: '==', value: plan });
    if (banned !== undefined) {
      filters.push({ field: 'isBanned', op: '==', value: banned === 'true' });
    }

    const users = await fb.query('users', filters, {
      orderBy:    'createdAt',
      dir:        'desc',
      limit:      Number(limit),
      startAfter: cursor || undefined,
    });

    // Client-side search by name/email
    const result = search
      ? users.filter(u =>
          u.email?.toLowerCase().includes(search.toLowerCase()) ||
          u.displayName?.toLowerCase().includes(search.toLowerCase())
        )
      : users;

    return R.success(res, {
      users:  result,
      count:  result.length,
      cursor: result[result.length - 1]?.createdAt || null,
    });
  } catch (err) { next(err); }
};

// GET /api/admin/users/:uid
exports.getUser = async (req, res, next) => {
  try {
    const { uid } = req.params;

    const [firestoreUser, authUser] = await Promise.all([
      fb.getDoc('users', uid),
      fb.getAuthUser(uid).catch(() => null),
    ]);

    if (!firestoreUser) return R.notFound(res, 'User not found.');

    // Fetch user's widgets + recent leads
    const [widgets, leads, usage] = await Promise.all([
      fb.query('widgets', [{ field: 'ownerId', op: '==', value: uid }]),
      fb.query('leads',   [{ field: 'ownerId', op: '==', value: uid }],
        { orderBy: 'createdAt', dir: 'desc', limit: 10 }),
      fb.getDoc('users', uid),
    ]);

    return R.success(res, {
      user:      { ...firestoreUser, emailVerified: authUser?.emailVerified },
      widgets:   widgets.length,
      recentLeads: leads,
      wordsUsed: usage?.wordsUsed || 0,
    });
  } catch (err) { next(err); }
};

// PATCH /api/admin/users/:uid/role
exports.setUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return R.badRequest(res, 'Role must be "user" or "admin".');
    }
    await Promise.all([
      fb.setUserClaims(req.params.uid, { role }),
      fb.updateDoc('users', req.params.uid, { role }),
    ]);
    logger.info(`[Admin] Role → "${role}" for ${req.params.uid} by ${req.user.uid}`);
    return R.success(res, {}, `Role updated to "${role}".`);
  } catch (err) { next(err); }
};

// PATCH /api/admin/users/:uid/ban
exports.banUser = async (req, res, next) => {
  try {
    const { banned, reason = '' } = req.body;
    const isBanned = !!banned;

    await Promise.all([
      fb.updateDoc('users', req.params.uid, {
        isBanned,
        banReason:  isBanned ? reason : null,
        bannedAt:   isBanned ? new Date().toISOString() : null,
        bannedBy:   isBanned ? req.user.uid : null,
      }),
      isBanned ? fb.revokeRefreshTokens(req.params.uid) : Promise.resolve(),
    ]);

    logger.info(`[Admin] User ${req.params.uid} ${isBanned ? 'BANNED' : 'UNBANNED'} by ${req.user.uid}`);
    return R.success(res, {}, `User ${isBanned ? 'banned' : 'unbanned'} successfully.`);
  } catch (err) { next(err); }
};

// DELETE /api/admin/users/:uid
exports.deleteUser = async (req, res, next) => {
  try {
    const { uid } = req.params;

    // Delete all user data
    const widgets = await fb.query('widgets', [{ field: 'ownerId', op: '==', value: uid }]);
    const deleteOps = widgets.map(w => ({ col: 'widgets', id: w.id, type: 'delete' }));
    if (deleteOps.length) await fb.batchUpdate(deleteOps);

    await Promise.all([
      fb.deleteDoc('users', uid),
      fb.deleteDoc('business_profiles', uid).catch(() => {}),
      fb.deleteAuthUser(uid),
    ]);

    logger.info(`[Admin] User ${uid} fully deleted by ${req.user.uid}`);
    return R.success(res, {}, 'User and all data deleted.');
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// PLAN MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// PATCH /api/admin/users/:uid/plan
exports.overridePlan = async (req, res, next) => {
  try {
    const { plan, reason = 'Admin override' } = req.body;
    const { plans } = require('../config/env');

    if (!plans[plan]) {
      return R.badRequest(res, `Invalid plan. Valid: ${Object.keys(plans).join(', ')}`);
    }

    await fb.updateDoc('users', req.params.uid, {
      plan,
      planOverriddenBy:  req.user.uid,
      planOverriddenAt:  new Date().toISOString(),
      planOverrideNote:  reason,
    });

    // Reset usage on upgrade
    await billingSvc.resetMonthlyUsage(req.params.uid);

    logger.info(`[Admin] Plan → "${plan}" for ${req.params.uid} by ${req.user.uid} — ${reason}`);
    return R.success(res, {}, `Plan set to "${plan}" and usage reset.`);
  } catch (err) { next(err); }
};

// POST /api/admin/users/:uid/reset-usage
exports.resetUsage = async (req, res, next) => {
  try {
    await billingSvc.resetMonthlyUsage(req.params.uid);
    logger.info(`[Admin] Usage reset for ${req.params.uid} by ${req.user.uid}`);
    return R.success(res, {}, 'Monthly usage reset.');
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// WIDGET MONITORING
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/widgets?limit=50&ownerId=xxx
exports.listWidgets = async (req, res, next) => {
  try {
    const { limit = 50, ownerId, isActive } = req.query;

    const filters = [];
    if (ownerId)  filters.push({ field: 'ownerId',  op: '==', value: ownerId });
    if (isActive !== undefined) {
      filters.push({ field: 'isActive', op: '==', value: isActive === 'true' });
    }

    const widgets = await fb.query('widgets', filters, {
      orderBy: 'totalChats',
      dir:     'desc',
      limit:   Number(limit),
    });

    return R.success(res, { widgets, count: widgets.length });
  } catch (err) { next(err); }
};

// PATCH /api/admin/widgets/:widgetId/toggle
exports.toggleWidget = async (req, res, next) => {
  try {
    const widget = await fb.getDoc('widgets', req.params.widgetId);
    if (!widget) return R.notFound(res, 'Widget not found.');

    const isActive = !widget.isActive;
    await fb.updateDoc('widgets', req.params.widgetId, { isActive });

    logger.info(`[Admin] Widget ${req.params.widgetId} → ${isActive ? 'ON' : 'OFF'} by ${req.user.uid}`);
    return R.success(res, { isActive }, `Widget ${isActive ? 'activated' : 'deactivated'}.`);
  } catch (err) { next(err); }
};

// GET /api/admin/widgets/:widgetId/conversations?limit=20
exports.getWidgetConversations = async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;
    const convos = await fb.query('conversations', [
      { field: 'widgetId', op: '==', value: req.params.widgetId },
    ], { orderBy: 'createdAt', dir: 'desc', limit: Number(limit) });

    return R.success(res, { conversations: convos, count: convos.length });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS PROFILES MONITORING
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/business?limit=50
exports.listBusinessProfiles = async (req, res, next) => {
  try {
    const { limit = 50, businessType } = req.query;

    const filters = [];
    if (businessType) filters.push({ field: 'businessType', op: '==', value: businessType });

    const profiles = await fb.query('business_profiles', filters, {
      orderBy: 'createdAt',
      dir:     'desc',
      limit:   Number(limit),
    });

    return R.success(res, { profiles, count: profiles.length });
  } catch (err) { next(err); }
};

// GET /api/admin/business/:widgetId
exports.getBusinessProfile = async (req, res, next) => {
  try {
    const profile = await fb.getDoc('business_profiles', req.params.widgetId);
    if (!profile) return R.notFound(res, 'Business profile not found.');
    return R.success(res, profile);
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// REVENUE & BILLING
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/revenue
exports.getRevenueStats = async (req, res, next) => {
  try {
    const { plans } = require('../config/env');

    // Prices come from env (set via STRIPE_PRICE_* and matched to plan names).
    // If not configured, fall back to default public prices.
    const planPrices = {
      starter:    Number(process.env.PLAN_PRICE_STARTER)    || 29,
      pro:        Number(process.env.PLAN_PRICE_PRO)        || 79,
      enterprise: Number(process.env.PLAN_PRICE_ENTERPRISE) || 299,
    };

    const paidPlans  = ['starter', 'pro', 'enterprise'];
    const planCounts = {};
    let   totalMRR   = 0;

    for (const plan of paidPlans) {
      const count      = await fb.count('users', [
        { field: 'plan',                op: '==', value: plan },
        { field: 'subscriptionStatus',  op: '==', value: 'active' },
      ]);
      planCounts[plan] = count;
      totalMRR        += count * (planPrices[plan] || 0);
    }

    // Recent 30d signups on paid plans
    const since30d    = new Date(Date.now() - 30 * 86400000).toISOString();
    const newPaid30d  = await fb.count('users', [
      { field: 'plan',      op: 'in', value: paidPlans },
      { field: 'createdAt', op: '>=', value: since30d  },
    ]);

    const totalPaid   = Object.values(planCounts).reduce((a, b) => a + b, 0);
    const totalFree   = await fb.count('users', [{ field: 'plan', op: '==', value: 'free' }]);
    const convRate    = totalFree + totalPaid > 0
      ? `${Math.round((totalPaid / (totalFree + totalPaid)) * 100)}%`
      : '0%';

    return R.success(res, {
      mrr:              `$${totalMRR.toLocaleString()}`,
      arr:              `$${(totalMRR * 12).toLocaleString()}`,
      totalPaidUsers:   totalPaid,
      totalFreeUsers:   totalFree,
      conversionRate:   convRate,
      newPaidLast30d:   newPaid30d,
      planBreakdown:    planCounts,
      planPrices,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN LOGS / ACTIVITY
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/leads?limit=50&widgetId=xxx
exports.getAllLeads = async (req, res, next) => {
  try {
    const { limit = 50, widgetId, status } = req.query;

    const filters = [];
    if (widgetId) filters.push({ field: 'widgetId', op: '==', value: widgetId });
    if (status)   filters.push({ field: 'status',   op: '==', value: status   });

    const leads = await fb.query('leads', filters, {
      orderBy: 'createdAt',
      dir:     'desc',
      limit:   Number(limit),
    });

    return R.success(res, { leads, count: leads.length });
  } catch (err) { next(err); }
};

// POST /api/admin/broadcast  — set a platform-wide notice (stored in Firestore)
exports.setBroadcast = async (req, res, next) => {
  try {
    const { message, type = 'info', expiresAt } = req.body;
    if (!message) return R.badRequest(res, 'Message is required.');

    await fb.setDoc('system', 'broadcast', {
      message,
      type,      // info | warning | maintenance
      expiresAt: expiresAt || null,
      createdBy: req.user.uid,
      createdAt: new Date().toISOString(),
      active:    true,
    });

    return R.success(res, {}, 'Broadcast message set.');
  } catch (err) { next(err); }
};

// DELETE /api/admin/broadcast
exports.clearBroadcast = async (req, res, next) => {
  try {
    await fb.updateDoc('system', 'broadcast', { active: false });
    return R.success(res, {}, 'Broadcast cleared.');
  } catch (err) { next(err); }
};
