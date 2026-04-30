const router = require('express').Router();
const ctrl   = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/',         ctrl.getMe);
router.put('/',         ctrl.updateMe);
router.delete('/',      ctrl.deleteMe);
router.get('/usage',    ctrl.getUsage);

module.exports = router;
