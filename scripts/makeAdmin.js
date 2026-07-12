/**
 * makeAdmin.js — promote a user to admin role by email.
 *
 * Usage:
 *   node scripts/makeAdmin.js user@example.com
 */

require('../config/env');
const fb     = require('../services/firebase.service');
const logger = require('../utils/logger');

const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/makeAdmin.js <email>');
  process.exit(1);
}

(async () => {
  try {
    // Look up user in Firebase Auth by email
    const authUser = await fb.getAuthUserByEmail(email);
    if (!authUser) {
      console.error(`No Firebase Auth user found for email: ${email}`);
      process.exit(1);
    }

    const uid = authUser.uid;

    // Check Firestore user doc exists
    const firestoreUser = await fb.getDoc('users', uid);
    if (!firestoreUser) {
      console.error(`Firestore user doc not found for uid: ${uid}. Has this user logged in yet?`);
      process.exit(1);
    }

    // Set custom claims + update Firestore role
    await Promise.all([
      fb.setUserClaims(uid, { role: 'admin' }),
      fb.updateDoc('users', uid, { role: 'admin' }),
    ]);

    logger.info(`[makeAdmin] SUCCESS — ${email} (uid: ${uid}) is now an admin.`);
    console.log(`\n✅  ${email} promoted to admin. They must log out and back in for the role to take effect.\n`);
    process.exit(0);
  } catch (err) {
    logger.error('[makeAdmin] Failed:', err.message);
    process.exit(1);
  }
})();
