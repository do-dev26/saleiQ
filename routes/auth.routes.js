const router     = require('express').Router();
const ctrl       = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { auth: authLimit } = require('../middleware/rateLimit.middleware');
const { validateRegister, validateLogin } = require('../middleware/validate.middleware');

router.post('/register',         authLimit, validateRegister, ctrl.register);
router.post('/login',            authLimit, validateLogin,    ctrl.login);
router.post('/login-with-token', authLimit, validateLogin,    ctrl.loginWithToken);
router.post('/refresh',                     ctrl.refreshToken);
router.post('/logout',           authenticate, ctrl.logout);
router.post('/forgot-password',  authLimit, ctrl.forgotPassword);
router.get('/me',                authenticate, ctrl.me);

module.exports = router;
