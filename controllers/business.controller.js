const businessSvc = require('../services/business.service');
const R           = require('../utils/responseFormatter');

// GET /api/business/:widgetId
exports.getProfile = async (req, res, next) => {
  try {
    const profile = await businessSvc.getProfile(req.params.widgetId);
    if (!profile) return R.success(res, null, 'No profile yet');
    if (profile.ownerId !== req.user.uid) return R.forbidden(res);
    return R.success(res, profile);
  } catch (err) { next(err); }
};

// POST /api/business/:widgetId  — create or update full profile
exports.upsertProfile = async (req, res, next) => {
  try {
    const { widgetId } = req.params;

    // Validate top products max 5
    if (req.body.topProducts && req.body.topProducts.length > 5) {
      return R.badRequest(res, 'Maximum 5 products/services allowed.');
    }

    const profile = await businessSvc.upsertProfile(widgetId, req.user.uid, req.body);
    return R.success(res, profile, 'Business profile saved. Website is being scraped in background.');
  } catch (err) {
    if (err.status) return R.error(res, err.message, err.status);
    next(err);
  }
};

// POST /api/business/:widgetId/rescrape  — re-scrape website on demand
exports.rescrape = async (req, res, next) => {
  try {
    const result = await businessSvc.rescrape(req.params.widgetId, req.user.uid);
    return R.success(res, result, 'Website re-scraped successfully.');
  } catch (err) {
    if (err.status) return R.error(res, err.message, err.status);
    next(err);
  }
};

// DELETE /api/business/:widgetId
exports.deleteProfile = async (req, res, next) => {
  try {
    await businessSvc.deleteProfile(req.params.widgetId, req.user.uid);
    return R.success(res, {}, 'Business profile deleted.');
  } catch (err) {
    if (err.status) return R.error(res, err.message, err.status);
    next(err);
  }
};

// GET /api/business/:widgetId/preview  — preview AI context string (for debugging)
exports.previewContext = async (req, res, next) => {
  try {
    const profile = await businessSvc.getProfile(req.params.widgetId);
    if (!profile) return R.notFound(res, 'No profile found.');
    if (profile.ownerId !== req.user.uid) return R.forbidden(res);

    const { buildAIContext } = require('../models/business.model');
    const context = buildAIContext(profile);
    return R.success(res, { context, charCount: context.length });
  } catch (err) { next(err); }
};
