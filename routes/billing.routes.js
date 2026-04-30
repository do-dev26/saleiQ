const router = require('express').Router();
const ctrl   = require('../controllers/billing.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Webhook handled separately in /webhooks/stripe.webhook.js

router.use(authenticate);

router.get('/plans',                ctrl.getPlans);
router.post('/checkout',            ctrl.createCheckoutSession);
router.post('/portal',              ctrl.createPortalSession);
router.get('/subscription',         ctrl.getSubscription);
router.post('/subscription/cancel', ctrl.cancelSubscription);

module.exports = router;
