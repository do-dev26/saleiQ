const router = require('express').Router();
const ctrl   = require('../controllers/lead.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requirePlan }  = require('../middleware/plan.middleware');

router.use(authenticate);

router.get('/',          ctrl.getLeads);
router.get('/export',    requirePlan('starter'), ctrl.exportLeads);
router.get('/:id',       ctrl.getLead);
router.put('/:id',       ctrl.updateLead);
router.delete('/:id',    ctrl.deleteLead);

module.exports = router;
