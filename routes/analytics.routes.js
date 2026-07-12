const router = require('express').Router();
const ctrl   = require('../controllers/analytics.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePlan }  = require('../middleware/plan.middleware');

router.use(authenticate);

router.get('/summary',                  ctrl.getSummary);
router.get('/widgets/:widgetId',        ctrl.getWidgetAnalytics);   // ownership verified inside service
router.get('/leads',     requirePlan('starter'), ctrl.getLeadAnalytics);
router.get('/conversations', requirePlan('pro'), ctrl.getConversationStats);

module.exports = router;
