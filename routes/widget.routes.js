const router = require('express').Router();
const ctrl   = require('../controllers/widget.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validateCreateWidget, validateUpdateWidget } = require('../middleware/validate.middleware');

// Fix #13: static paths before dynamic ones
router.get('/meta/brain-options', authenticate, (req, res) => {
  const { BRAIN_OPTIONS } = require('../services/ai.service');
  res.json({ success: true, data: BRAIN_OPTIONS });
});

// Public — no auth required
router.get('/:widgetId/public', ctrl.getPublicWidget);

// Protected
router.use(authenticate);

router.get('/',                ctrl.getWidgets);
router.post('/',               validateCreateWidget, ctrl.createWidget);
router.get('/:id',             ctrl.getWidget);
router.put('/:id',             validateUpdateWidget, ctrl.updateWidget);
router.delete('/:id',          ctrl.deleteWidget);
router.get('/:id/snippet',     ctrl.getSnippet);

module.exports = router;
