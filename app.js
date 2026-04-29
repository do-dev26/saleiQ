const express        = require('express');
const cors           = require('cors');
const helmet         = require('helmet');
const morgan         = require('morgan');
const path           = require('path');
const { allowedOrigins, isDev } = require('./config/env');
const { general }    = require('./middleware/rateLimit.middleware');
const logger         = require('./utils/logger');

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.set('trust proxy', 1); // required for rate-limiter on Render/Heroku

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow widget.js to load cross-origin
}));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));

// ── Stripe webhook MUST be before express.json() ──────────────────────────────
app.use('/webhook/stripe', require('./webhooks/stripe.webhook'));

// ── Body Parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(morgan(isDev ? 'dev' : 'combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ── Static Files (widget.js, widget.css) ──────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
  },
}));

// ── Global Rate Limit ─────────────────────────────────────────────────────────
app.use('/api/', general);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth.routes'));
app.use('/api/users',     require('./routes/user.routes'));
app.use('/api/widgets',   require('./routes/widget.routes'));
app.use('/api/chat',      require('./routes/chat.routes'));
app.use('/api/leads',     require('./routes/lead.routes'));
app.use('/api/analytics', require('./routes/analytics.routes'));
app.use('/api/billing',   require('./routes/billing.routes'));
app.use('/api/admin',     require('./routes/admin.routes'));
app.use('/api/business',  require('./routes/business.routes'));

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) =>
  res.json({ status: 'ok', ts: new Date().toISOString(), env: process.env.NODE_ENV })
);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found.' }));

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  logger.error(`[${req.method}] ${req.path} — ${err.message}`);

  if (err.message?.startsWith('CORS')) {
    return res.status(403).json({ success: false, message: err.message });
  }

  res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error.' : err.message,
    ...(isDev && { stack: err.stack }),
  });
});

module.exports = app;
