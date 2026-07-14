const router = require('express').Router();
const ctrl   = require('../controllers/widget.controller');
const { authenticate } = require('../middleware/auth.middleware');

// ── Public ─────────────────────────────────────────────────────────────────────
router.get('/:widgetId/public', ctrl.getPublicWidget);

// Brain options for widget creation dropdown — authenticated
router.get('/meta/brain-options', authenticate, (req, res) => {
  const { BRAIN_OPTIONS } = require('../services/ai.service');
  res.json({ success: true, data: BRAIN_OPTIONS });
});

// ── Protected ──────────────────────────────────────────────────────────────────
router.use(authenticate);

router.get('/',                ctrl.getWidgets);
router.post('/',               ctrl.createWidget);
router.get('/:id',             ctrl.getWidget);
router.put('/:id',             ctrl.updateWidget);
router.delete('/:id',          ctrl.deleteWidget);
router.get('/:id/snippet',     ctrl.getSnippet);

module.exports = router;
