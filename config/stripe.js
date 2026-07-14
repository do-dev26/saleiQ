const Stripe          = require('stripe');
const { stripe: cfg } = require('./env');

const stripe = new Stripe(cfg.secretKey, {
  apiVersion: '2024-04-10',
  telemetry:  false,
});

console.log('✅  Stripe initialised');

module.exports = stripe;
