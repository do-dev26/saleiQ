const router     = require('express').Router();
const billingSvc = require('../services/billing.service');
const logger     = require('../utils/logger');

/**
 * POST /webhook/stripe
 * Raw body required — registered BEFORE express.json() in app.js
 */
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = billingSvc.constructEvent(req.body, sig);
  } catch (err) {
    logger.error('[Webhook] Signature validation failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    await billingSvc.handleWebhookEvent(event);
    res.json({ received: true });
  } catch (err) {
    logger.error('[Webhook] Handler error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

// Need express available — reference from app
const express = require('express');

module.exports = router;
