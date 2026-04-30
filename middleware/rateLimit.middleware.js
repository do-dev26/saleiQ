const rateLimit = require('express-rate-limit');

const makeLimit = (windowMin, max, message) =>
  rateLimit({
    windowMs:       windowMin * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders:   false,
    message:         { success: false, message },
  });

// General API — 200 req / 15 min per IP
exports.general = makeLimit(15, 200, 'Too many requests. Please try again later.');

// Auth endpoints — 20 req / 15 min (brute-force protection)
exports.auth = makeLimit(15, 20, 'Too many login attempts. Please try again in 15 minutes.');

// Chat endpoint — 60 req / min per IP (widget traffic)
exports.chat = makeLimit(1, 60, 'Chat rate limit exceeded. Please slow down.');

// Admin endpoints — 100 req / 15 min
exports.admin = makeLimit(15, 100, 'Too many admin requests.');
