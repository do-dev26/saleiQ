const analyticsSvc = require('../services/analytics.service');
const R            = require('../utils/responseFormatter');

exports.getSummary = async (req, res, next) => {
  try {
    const data = await analyticsSvc.getSummary(req.user.uid, req.user.plan);
    return R.success(res, data);
  } catch (err) { next(err); }
};

exports.getWidgetAnalytics = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const data = await analyticsSvc.getWidgetAnalytics(req.params.widgetId, req.user.uid, Number(days));
    return R.success(res, data);
  } catch (err) {
    if (err.status) return R.error(res, err.message, err.status);
    next(err);
  }
};

exports.getLeadAnalytics = async (req, res, next) => {
  try {
    const data = await analyticsSvc.getLeadAnalytics(req.user.uid);
    return R.success(res, data);
  } catch (err) { next(err); }
};

exports.getConversationStats = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const data = await analyticsSvc.getConversationStats(req.user.uid, Number(days));
    return R.success(res, data);
  } catch (err) { next(err); }
};
