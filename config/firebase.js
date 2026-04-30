const admin  = require('firebase-admin');
const { firebase } = require('./env');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   firebase.projectId,
      clientEmail: firebase.clientEmail,
      privateKey:  firebase.privateKey,
    }),
  });
  console.log('✅  Firebase Admin initialised');
}

const auth = admin.auth();
const db   = admin.firestore();

// Firestore settings — disable deprecated warnings
db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, auth, db };
