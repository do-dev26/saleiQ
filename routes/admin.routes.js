const router = require('express').Router();
const ctrl   = require('../controllers/admin.controller');
const { authenticate }  = require('../middleware/auth.middleware');
const { requireAdmin }  = require('../middleware/admin.middleware');
const { admin: adminLimit } = require('../middleware/rateLimit.middleware');

// All admin routes require auth + admin role
router.use(authenticate, requireAdmin, adminLimit);

// ── Platform Stats ─────────────────────────────────────────────────────────
router.get('/stats',               ctrl.getPlatformStats);
router.get('/revenue',             ctrl.getRevenueStats);

// ── User Management ────────────────────────────────────────────────────────
router.get('/users',               ctrl.listUsers);
router.get('/users/:uid',          ctrl.getUser);
router.patch('/users/:uid/role',   ctrl.setUserRole);
router.patch('/users/:uid/ban',    ctrl.banUser);
router.patch('/users/:uid/plan',   ctrl.overridePlan);
router.post('/users/:uid/reset-usage', ctrl.resetUsage);
router.delete('/users/:uid',       ctrl.deleteUser);

// ── Widget Monitoring ──────────────────────────────────────────────────────
router.get('/widgets',                              ctrl.listWidgets);
router.patch('/widgets/:widgetId/toggle',           ctrl.toggleWidget);
router.get('/widgets/:widgetId/conversations',      ctrl.getWidgetConversations);

// ── Business Profiles ──────────────────────────────────────────────────────
router.get('/business',            ctrl.listBusinessProfiles);
router.get('/business/:widgetId',  ctrl.getBusinessProfile);

// ── Leads ──────────────────────────────────────────────────────────────────
router.get('/leads',               ctrl.getAllLeads);

// ── Broadcast ──────────────────────────────────────────────────────────────
router.post('/broadcast',          ctrl.setBroadcast);
router.delete('/broadcast',        ctrl.clearBroadcast);

module.exports = router;
