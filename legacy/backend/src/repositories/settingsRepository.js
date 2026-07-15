// Data-access layer: key/value settings.
const { db } = require('../config/database');

module.exports = {
  get(key) { const r = db.prepare('SELECT value FROM settings WHERE key=?').get(key); return r ? r.value : null; },
  set(key, value) { db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value)); },
  all() { return Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map(r => [r.key, r.value])); },
};
