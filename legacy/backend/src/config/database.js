// Database connection (SQLite via better-sqlite3). Local file storage with
// automatic scheduled backups (see services/backupService.js).
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const env = require('./env');

if (!fs.existsSync(env.dataDir)) fs.mkdirSync(env.dataDir, { recursive: true });

const dbPath = path.join(env.dataDir, 'cheque_system.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = { db, dbPath };
