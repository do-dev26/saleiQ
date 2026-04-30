const { forbidden } = require('../utils/responseFormatter');

/**
 * Blocks access for non-admin users.
 * Must be used AFTER authenticate middleware.
 */
exports.requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return forbidden(res, 'Admin access required.');
  }
  next();
};
