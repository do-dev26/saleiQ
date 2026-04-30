const billingSvc = require('../services/billing.service');
const R          = require('../utils/responseFormatter');

exports.getPlans = (req, res) => R.success(res, billingSvc.getPlans());

exports.createCheckoutSession = async (req, res, next) => {
  try {
    const { planId } = req.body;
    if (!planId) return R.badRequest(res, 'planId is required.');
    const session = await billingSvc.createCheckoutSession(req.user.uid, req.user.email, planId);
    return R.success(res, { url: session.url });
  } catch (err) {
    if (err.status) return R.error(res, err.message, err.status);
    next(err);
  }
};

exports.createPortalSession = async (req, res, next) => {
  try {
    const session = await billingSvc.createPortalSession(req.user.uid);
    return R.success(res, { url: session.url });
  } catch (err) {
    if (err.status) return R.error(res, err.message, err.status);
    next(err);
  }
};

exports.getSubscription = async (req, res, next) => {
  try {
    const data = await billingSvc.getSubscription(req.user.uid);
    return R.success(res, data);
  } catch (err) { next(err); }
};

exports.cancelSubscription = async (req, res, next) => {
  try {
    await billingSvc.cancelSubscription(req.user.uid);
    return R.success(res, {}, 'Subscription will cancel at end of billing period.');
  } catch (err) {
    if (err.status) return R.error(res, err.message, err.status);
    next(err);
  }
};
