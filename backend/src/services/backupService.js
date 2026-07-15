// Automatic database backups: copies the SQLite file into data/backups with a
// timestamp and keeps only the newest N copies.
const fs = require('fs');
const path = require('path');
const { db, dbPath } = require('../config/database');
const env = require('../config/env');

const backupDir = path.join(env.dataDir, 'backups');

function backupNow() {
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const target = path.join(backupDir, `cheque_system-${stamp}.db`);
  db.pragma('wal_checkpoint(TRUNCATE)');       // flush WAL so the copy is complete
  fs.copyFileSync(dbPath, target);
  rotate();
  console.log(`Backup written: ${target}`);
  return target;
}

function rotate() {
  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db')).sort();
  while (files.length > env.backupKeep) fs.unlinkSync(path.join(backupDir, files.shift()));
}

function list() {
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir).filter(f => f.endsWith('.db')).sort().reverse()
    .map(f => ({ file: f, size: fs.statSync(path.join(backupDir, f)).size }));
}

module.exports = { backupNow, list };
