const { admin, auth, db } = require('../config/firebase');
const logger              = require('../utils/logger');

const svc = {
  // ── Auth ────────────────────────────────────────────────────────────────────
  createAuthUser:       (props)  => auth.createUser(props),
  getAuthUser:          (uid)    => auth.getUser(uid),
  getAuthUserByEmail:   (email)  => auth.getUserByEmail(email),
  deleteAuthUser:       (uid)    => auth.deleteUser(uid),
  verifyIdToken:        (token)  => auth.verifyIdToken(token),
  revokeRefreshTokens:  (uid)    => auth.revokeRefreshTokens(uid),

  async getUserClaims(uid) {
    const u = await auth.getUser(uid);
    return u.customClaims || {};
  },

  setUserClaims: (uid, claims) => auth.setCustomUserClaims(uid, claims),

  async generatePasswordResetLink(email) {
    return auth.generatePasswordResetLink(email);
  },

  async listAuthUsers(maxResults = 100, pageToken) {
    return auth.listUsers(maxResults, pageToken);
  },

  // ── Firestore Generic ────────────────────────────────────────────────────────
  async getDoc(col, id) {
    const snap = await db.collection(col).doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  },

  async setDoc(col, id, data) {
    await db.collection(col).doc(id).set(data);
    return data;
  },

  async updateDoc(col, id, updates) {
    updates.updatedAt = new Date().toISOString();
    await db.collection(col).doc(id).update(updates);
    return updates;
  },

  async deleteDoc(col, id) {
    await db.collection(col).doc(id).delete();
  },

  async addDoc(col, data) {
    const ref = await db.collection(col).add(data);
    return { id: ref.id, ...data };
  },

  async query(col, filters = [], opts = {}) {
    let q = db.collection(col);
    for (const f of filters) q = q.where(f.field, f.op, f.value);
    if (opts.orderBy)    q = q.orderBy(opts.orderBy, opts.dir || 'asc');
    if (opts.limit)      q = q.limit(opts.limit);
    if (opts.startAfter) q = q.startAfter(opts.startAfter);
    const snap = await q.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async count(col, filters = []) {
    let q = db.collection(col);
    for (const f of filters) q = q.where(f.field, f.op, f.value);
    const snap = await q.count().get();
    return snap.data().count;
  },

  increment: (n) => admin.firestore.FieldValue.increment(n),
  serverTs:  ()  => admin.firestore.FieldValue.serverTimestamp(),
  arrayUnion: (...v) => admin.firestore.FieldValue.arrayUnion(...v),

  // ── Batch Operations ─────────────────────────────────────────────────────────
  async batchUpdate(operations) {
    const batch = db.batch();
    for (const op of operations) {
      const ref = db.collection(op.col).doc(op.id);
      if (op.type === 'set')    batch.set(ref, op.data);
      if (op.type === 'update') batch.update(ref, op.data);
      if (op.type === 'delete') batch.delete(ref);
    }
    await batch.commit();
  },
};

module.exports = svc;
