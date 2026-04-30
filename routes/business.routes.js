const router = require('express').Router();
const ctrl   = require('../controllers/business.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/:widgetId',           ctrl.getProfile);
router.post('/:widgetId',          ctrl.upsertProfile);
router.post('/:widgetId/rescrape', ctrl.rescrape);
router.get('/:widgetId/preview',   ctrl.previewContext);
router.delete('/:widgetId',        ctrl.deleteProfile);

module.exports = router;
