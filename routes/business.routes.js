const router = require('express').Router();
const ctrl   = require('../controllers/business.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validateBusinessProfile } = require('../middleware/validate.middleware');

router.use(authenticate);

// Fix #12: specific paths must come before /:widgetId to avoid param swallowing
router.get('/:widgetId/preview',   ctrl.previewContext);
router.post('/:widgetId/rescrape', ctrl.rescrape);

router.get('/:widgetId',           ctrl.getProfile);
router.post('/:widgetId',          validateBusinessProfile, ctrl.upsertProfile);
router.delete('/:widgetId',        ctrl.deleteProfile);

module.exports = router;
