const { plans }   = require('../config/env');
const { forbidden } = require('../utils/responseFormatter');

const HIERARCHY = ['free', 'starter', 'pro', 'enterprise'];

/**
 * requirePlan('pro') — blocks access if user's plan is below the required tier.
 *
 * Usage:
 *   router.get('/export', requirePlan('pro'), exportController);
 */
exports.requirePlan = (minPlan) => (req, res, next) => {
  const userPlan = req.user?.plan || 'free';
  const userIdx  = HIERARCHY.indexOf(userPlan);
  const reqIdx   = HIERARCHY.indexOf(minPlan);

  if (userIdx < reqIdx) {
    return forbidden(res,
      `This feature requires the "${plans[minPlan]?.name || minPlan}" plan or higher. ` +
      `You are on "${plans[userPlan]?.name || userPlan}".`
    );
  }
  next();
};

/**
 * checkWordLimit — blocks chat if user has exceeded their monthly word limit.
 * Attaches req.wordLimit and req.wordsRemaining for downstream use.
 */
exports.checkWordLimit = (req, res, next) => {
  const plan       = req.user?.plan || 'free';
  const planCfg    = plans[plan] || plans.free;
  const used       = req.user?.wordsUsed || 0;
  const limit      = planCfg.wordLimit;

  if (limit !== Infinity && used >= limit) {
    return res.status(429).json({
      success: false,
      message: `Monthly word limit reached (${limit.toLocaleString()} words). Please upgrade your plan.`,
      wordsUsed:  used,
      wordLimit:  limit,
      upgradeUrl: `${process.env.APP_URL}/billing`,
    });
  }

  req.wordLimit      = limit;
  req.wordsRemaining = limit === Infinity ? Infinity : limit - used;
  next();
};
