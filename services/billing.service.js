const stripe       = require('../config/stripe');
const fb           = require('./firebase.service');
const { stripe: cfg, appUrl, plans } = require('../config/env');
const logger       = require('../utils/logger');

const PLAN_DATA = [
  { id: 'free',       name: 'Free',       price: 0,    priceId: null,              ...plans.free       },
  { id: 'starter',    name: 'Starter',    price: 29,   priceId: cfg.prices.starter,...plans.starter    },
  { id: 'pro',        name: 'Pro',        price: 79,   priceId: cfg.prices.pro,    ...plans.pro        },
  { id: 'enterprise', name: 'Enterprise', price: null, priceId: cfg.prices.enterprise,...plans.enterprise },
];

exports.getPlans = () => PLAN_DATA;

exports.ensureCustomer = async (uid, email) => {
  const user = await fb.getDoc('users', uid);
  if (user?.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({ email, metadata: { uid } });
  await fb.updateDoc('users', uid, { stripeCustomerId: customer.id });
  return customer.id;
};

exports.createCheckoutSession = async (uid, email, planId) => {
  const plan = PLAN_DATA.find(p => p.id === planId);
  if (!plan || !plan.priceId) throw Object.assign(new Error('Invalid plan'), { status: 400 });

  const customerId = await exports.ensureCustomer(uid, email);

  return stripe.checkout.sessions.create({
    customer:    customerId,
    mode:        'subscription',
    line_items:  [{ price: plan.priceId, quantity: 1 }],
    success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${appUrl}/billing`,
    metadata:    { uid, planId },
    subscription_data: { metadata: { uid, planId } },
  });
};

exports.createPortalSession = async (uid) => {
  const user = await fb.getDoc('users', uid);
  if (!user?.stripeCustomerId) throw Object.assign(new Error('No billing account found'), { status: 400 });

  return stripe.billingPortal.sessions.create({
    customer:   user.stripeCustomerId,
    return_url: `${appUrl}/billing`,
  });
};

exports.getSubscription = async (uid) => {
  const user = await fb.getDoc('users', uid);
  if (!user?.stripeCustomerId) return { plan: 'free', status: 'inactive' };

  const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: 'active', limit: 1 });
  const sub  = subs.data[0];
  if (!sub) return { plan: user.plan || 'free', status: 'inactive' };

  return {
    plan:              sub.metadata?.planId || 'free',
    status:            sub.status,
    currentPeriodEnd:  new Date(sub.current_period_end * 1000).toISOString(),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
};

exports.cancelSubscription = async (uid) => {
  const user = await fb.getDoc('users', uid);
  if (!user?.stripeCustomerId) throw Object.assign(new Error('No billing account'), { status: 400 });

  const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: 'active', limit: 1 });
  const sub  = subs.data[0];
  if (!sub) throw Object.assign(new Error('No active subscription'), { status: 400 });

  return stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
};

exports.constructEvent = (rawBody, sig) =>
  stripe.webhooks.constructEvent(rawBody, sig, cfg.webhookSecret);

exports.handleWebhookEvent = async (event) => {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const { uid, planId } = session.metadata || {};
      if (uid && planId) {
        await fb.updateDoc('users', uid, {
          plan:             planId,
          stripeCustomerId: session.customer,
          subscriptionId:   session.subscription,
          subscriptionStatus: 'active',
        });
        await exports.resetMonthlyUsage(uid);
        logger.info(`[Billing] Plan activated: ${planId} for user ${uid}`);
      }
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub   = event.data.object;
      const users = await fb.query('users', [
        { field: 'stripeCustomerId', op: '==', value: sub.customer },
      ], { limit: 1 });

      if (users.length) {
        const isActive = sub.status === 'active';
        await fb.updateDoc('users', users[0].id, {
          plan:               isActive ? (sub.metadata?.planId || 'free') : 'free',
          subscriptionStatus: sub.status,
        });
      }
      break;
    }

    case 'invoice.payment_failed':
      logger.warn('[Billing] Payment failed for customer', event.data.object.customer);
      break;

    default:
      logger.debug(`[Webhook] Unhandled: ${event.type}`);
  }
};

exports.resetMonthlyUsage = async (uid) => {
  const nextReset = new Date();
  nextReset.setMonth(nextReset.getMonth() + 1);
  nextReset.setDate(1);
  await fb.updateDoc('users', uid, {
    wordsUsed:      0,
    usageResetDate: nextReset.toISOString(),
  });
};
