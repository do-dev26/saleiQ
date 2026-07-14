require('dotenv').config();

const required = [
  'JWT_SECRET',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'ANTHROPIC_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`\n❌  Missing required env variables:\n   ${missing.join(', ')}\n`);
  process.exit(1);
}

module.exports = {
  port:            process.env.PORT || 5000,
  nodeEnv:         process.env.NODE_ENV || 'development',
  isDev:           process.env.NODE_ENV !== 'production',
  appUrl:          process.env.APP_URL || 'http://localhost:5000',
  allowedOrigins:  process.env.ALLOWED_ORIGINS?.split(',') || ['*'],

  jwt: {
    secret:        process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh',
    accessTTL:     '15m',
    refreshTTL:    '7d',
  },

  firebase: {
    projectId:    process.env.FIREBASE_PROJECT_ID,
    clientEmail:  process.env.FIREBASE_CLIENT_EMAIL,
    privateKey:   process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model:  process.env.AI_MODEL || 'claude-haiku-4-5-20251001',
  },

  stripe: {
    secretKey:      process.env.STRIPE_SECRET_KEY,
    webhookSecret:  process.env.STRIPE_WEBHOOK_SECRET,
    prices: {
      starter:    process.env.STRIPE_PRICE_STARTER,
      pro:        process.env.STRIPE_PRICE_PRO,
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
    },
  },

  plans: {
    free:       { wordLimit: Number(process.env.FREE_WORD_LIMIT)    || 500,   widgets: 1,  name: 'Free'       },
    starter:    { wordLimit: Number(process.env.STARTER_WORD_LIMIT) || 5000,  widgets: 3,  name: 'Starter'    },
    pro:        { wordLimit: Number(process.env.PRO_WORD_LIMIT)     || 50000, widgets: 10, name: 'Pro'        },
    enterprise: { wordLimit: Infinity,                                         widgets: -1, name: 'Enterprise' },
  },
};
