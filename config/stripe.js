const Stripe          = require('stripe');
const { stripe: cfg } = require('./env');

const stripe = new Stripe(cfg.secretKey, {
  apiVersion: '2024-06-20',
  telemetry:  false,
});

console.log('✅  Stripe initialised');

module.exports = stripe;
