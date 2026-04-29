// Load and validate environment variables first
const { port } = require('./config/env');

// Initialise Firebase and Stripe singletons early
require('./config/firebase');
require('./config/stripe');

const app    = require('./app');
const logger = require('./utils/logger');

const server = app.listen(port, () => {
  logger.info(`🚀  Server running on port ${port} [${process.env.NODE_ENV}]`);
  logger.info(`📡  Health: http://localhost:${port}/health`);
  logger.info(`🤖  Widget: http://localhost:${port}/widget.js`);
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
const shutdown = (signal) => {
  logger.info(`[Server] ${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info('[Server] HTTP server closed');
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => process.exit(1), 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('[UnhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('[UncaughtException]', err);
  process.exit(1);
});
