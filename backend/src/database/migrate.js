// Creates all tables and seeds the single admin user + default settings.
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const env = require('../config/env');

function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  // Seed the single admin user if none exists
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0) {
    const hash = bcrypt.hashSync(env.admin.password, 10);
    db.prepare('INSERT INTO users (username, password_hash, phone) VALUES (?, ?, ?)')
      .run(env.admin.username, hash, env.admin.phone);
    console.log(`Admin user "${env.admin.username}" created.`);
  }

  // Default settings (only inserted if missing)
  const defaults = {
    alert_intervals: '7,3,1',           // days before due date
    admin_phone: env.admin.phone,
    currency: 'LKR',
    overdue_alerts: '1',                // send warnings for overdue pending cheques
  };
  const ins = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaults)) ins.run(k, v);

  console.log('Migration complete.');
}

migrate();
module.exports = migrate;
