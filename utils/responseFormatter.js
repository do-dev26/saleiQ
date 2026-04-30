/**
 * Unified response formatter — all API responses go through these helpers
 * so the frontend always gets a consistent shape.
 */

exports.success = (res, data = {}, message = 'OK', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

exports.created = (res, data = {}, message = 'Created') => {
  return exports.success(res, data, message, 201);
};

exports.error = (res, message = 'Something went wrong', statusCode = 500, details = null) => {
  const body = { success: false, message };
  if (details) body.details = details;
  return res.status(statusCode).json(body);
};

exports.unauthorized = (res, message = 'Unauthorized') =>
  exports.error(res, message, 401);

exports.forbidden = (res, message = 'Forbidden') =>
  exports.error(res, message, 403);

exports.notFound = (res, message = 'Not found') =>
  exports.error(res, message, 404);

exports.badRequest = (res, message = 'Bad request', details = null) =>
  exports.error(res, message, 400, details);

exports.tooMany = (res, message = 'Rate limit exceeded') =>
  exports.error(res, message, 429);
