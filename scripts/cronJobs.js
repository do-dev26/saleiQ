require('../config/env'); // validate env vars first
const cron   = require('node-cron');
const fb     = require('../services/firebase.service');
const billingSvc = require('../services/billing.service');
const logger = require('../utils/logger');

/**
 * Run at midnight on the 1st of every month — reset word usage for all users.
 */
cron.schedule('0 0 1 * *', async () => {
  logger.info('[Cron] Monthly usage reset starting...');
  try {
    // Get all users whose resetDate has passed
    const now   = new Date().toISOString();
    const users = await fb.query('users', [
      { field: 'usageResetDate', op: '<=', value: now },
      { field: 'wordsUsed',      op: '>',  value: 0   },
    ]);

    logger.info(`[Cron] Resetting usage for ${users.length} users`);

    for (const user of users) {
      await billingSvc.resetMonthlyUsage(user.id);
    }

    logger.info('[Cron] Monthly usage reset complete.');
  } catch (err) {
    logger.error('[Cron] Monthly reset failed:', err.message);
  }
});

/**
 * Run daily at 2am — disable widgets for users with expired/cancelled subscriptions.
 */
cron.schedule('0 2 * * *', async () => {
  logger.info('[Cron] Expired plan check starting...');
  try {
    // Find free users who still have widgets beyond the free limit
    const freeUsers = await fb.query('users', [
      { field: 'plan',        op: '==', value: 'free' },
      { field: 'widgetCount', op: '>',  value: 1      },
    ]);

    for (const user of freeUsers) {
      // Disable extra widgets — keep only the most recently created
      const widgets = await fb.query('widgets', [
        { field: 'ownerId',  op: '==', value: user.id },
        { field: 'isActive', op: '==', value: true    },
      ], { orderBy: 'createdAt', dir: 'asc' });

      // Disable all but the first
      const toDisable = widgets.slice(1);
      for (const w of toDisable) {
        await fb.updateDoc('widgets', w.id, { isActive: false });
        logger.info(`[Cron] Disabled widget ${w.id} (plan downgrade)`);
      }
    }

    logger.info('[Cron] Expired plan check complete.');
  } catch (err) {
    logger.error('[Cron] Expired plan check failed:', err.message);
  }
});

/**
 * Run every Sunday at 3am — clean up old conversation logs (>90 days) for free users.
 */
cron.schedule('0 3 * * 0', async () => {
  logger.info('[Cron] Old conversation cleanup starting...');
  try {
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
    const old    = await fb.query('conversations', [
      { field: 'createdAt', op: '<', value: cutoff },
    ], { limit: 500 });

    const ops = old.map(c => ({ col: 'conversations', id: c.id, type: 'delete' }));
    if (ops.length) await fb.batchUpdate(ops);

    logger.info(`[Cron] Cleaned up ${ops.length} old conversation records.`);
  } catch (err) {
    logger.error('[Cron] Cleanup failed:', err.message);
  }
});

logger.info('✅  Cron jobs scheduled.');
