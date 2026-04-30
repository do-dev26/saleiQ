/**
 * Run this once to make yourself admin:
 *   node scripts/makeAdmin.js your@email.com
 */
require('../config/env');
const { auth, db } = require('../config/firebase');

async function makeAdmin(email) {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.setCustomUserClaims(user.uid, { role: 'admin' });
    await db.collection('users').doc(user.uid).update({ role: 'admin' });
    console.log(`✅ "${email}" is now admin (uid: ${user.uid})`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

const email = process.argv[2];
if (!email) { console.error('Usage: node scripts/makeAdmin.js your@email.com'); process.exit(1); }
makeAdmin(email);
