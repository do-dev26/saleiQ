const widgetSvc = require('../services/widget.service');
const R         = require('../utils/responseFormatter');

exports.getWidgets    = async (req, res, next) => {
  try {
    const widgets = await widgetSvc.getWidgets(req.user.uid);
    return R.success(res, widgets);
  } catch (err) { next(err); }
};

exports.createWidget  = async (req, res, next) => {
  try {
    const widget = await widgetSvc.createWidget(req.user.uid, req.body, req.user.plan);
    return R.created(res, widget, 'Widget created.');
  } catch (err) {
    if (err.status) return R.error(res, err.message, err.status);
    next(err);
  }
};

exports.getWidget     = async (req, res, next) => {
  try {
    const widget = await widgetSvc.getWidget(req.params.id);
    if (!widget) return R.notFound(res, 'Widget not found.');
    if (widget.ownerId !== req.user.uid) return R.forbidden(res);
    return R.success(res, widget);
  } catch (err) { next(err); }
};

exports.updateWidget  = async (req, res, next) => {
  try {
    const updates = await widgetSvc.updateWidget(req.params.id, req.user.uid, req.body);
    return R.success(res, updates, 'Widget updated.');
  } catch (err) {
    if (err.status) return R.error(res, err.message, err.status);
    next(err);
  }
};

exports.deleteWidget  = async (req, res, next) => {
  try {
    await widgetSvc.deleteWidget(req.params.id, req.user.uid);
    return R.success(res, {}, 'Widget deleted.');
  } catch (err) {
    if (err.status) return R.error(res, err.message, err.status);
    next(err);
  }
};

// GET /api/widgets/:widgetId/public — no auth, returns embed config
exports.getPublicWidget = async (req, res, next) => {
  try {
    const widget = await widgetSvc.getPublicWidget(req.params.widgetId);
    if (!widget) return R.notFound(res, 'Widget not found or inactive.');
    return R.success(res, widget);
  } catch (err) { next(err); }
};

// GET /api/widgets/:widgetId/snippet — returns embed script tag HTML
exports.getSnippet = async (req, res, next) => {
  try {
    const widget = await widgetSvc.getWidget(req.params.id);
    if (!widget) return R.notFound(res, 'Widget not found.');
    if (widget.ownerId !== req.user.uid) return R.forbidden(res);

    const { appUrl } = require('../config/env');
    const snippet = `<!-- AI Widget by YourSaaS -->
<script>
  window.AiWidgetConfig = { widgetId: "${widget.id}" };
</script>
<script src="${appUrl}/widget.js" defer></script>`;

    return R.success(res, { snippet, widgetId: widget.id });
  } catch (err) { next(err); }
};
