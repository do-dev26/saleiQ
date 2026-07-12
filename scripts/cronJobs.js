require('../config/env'); // validate env vars first

// ── Single-instance guard ──────────────────────────────────────────────────────
// Prevents duplicate cron runs when multiple processes start this file.
// Set CRON_INSTANCE_ID in env; only the instance with id "1" (or unset) runs jobs.
const instanceId = process.env.CRON_INSTANCE_ID;
if (instanceId && instanceId !== '1') {
  console.log(`[Cron] Skipping — this is instance ${instanceId}, only instance 1 runs cron.`);
  process.exit(0);
}

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
 * Run every Sunday at 3am — clean up old conversation logs (>90 days) for FREE users only.
 * Paid users get indefinite retention.
 */
cron.schedule('0 3 * * 0', async () => {
  logger.info('[Cron] Old conversation cleanup starting...');
  try {
    // Only delete conversations belonging to free-plan users
    const freeUsers = await fb.query('users', [
      { field: 'plan', op: '==', value: 'free' },
    ]);
    const freeUids = freeUsers.map(u => u.id);

    if (!freeUids.length) {
      logger.info('[Cron] No free users found — cleanup skipped.');
      return;
    }

    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();

    // Firestore does not support 'in' + range in the same query without a composite index,
    // so we process in batches per user (keeps it simple and index-free).
    let totalDeleted = 0;
    for (const uid of freeUids) {
      const old = await fb.query('conversations', [
        { field: 'ownerId',   op: '==', value: uid },
        { field: 'createdAt', op: '<',  value: cutoff },
      ], { limit: 500 });

      if (!old.length) continue;
      const ops = old.map(c => ({ col: 'conversations', id: c.id, type: 'delete' }));
      await fb.batchUpdate(ops);
      totalDeleted += ops.length;
    }

    logger.info(`[Cron] Cleaned up ${totalDeleted} old conversation records (free users only).`);
  } catch (err) {
    logger.error('[Cron] Cleanup failed:', err.message);
  }
});

logger.info('✅  Cron jobs scheduled.');
