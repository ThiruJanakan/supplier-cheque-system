// Data-access layer: users (single admin).
const { db } = require('../config/database');

module.exports = {
  findByUsername(username) { return db.prepare('SELECT * FROM users WHERE username = ?').get(username); },
  findById(id) { return db.prepare('SELECT id, username, phone, role, created_at FROM users WHERE id = ?').get(id); },
  updatePassword(id, hash) { return db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, id); },
  updatePhone(id, phone) { return db.prepare('UPDATE users SET phone=? WHERE id=?').run(phone, id); },
};
