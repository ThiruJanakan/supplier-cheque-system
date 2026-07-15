// Centralised environment configuration (single source of truth for the whole app)
const path = require('path');
const fs = require('fs');

// Minimal .env loader (no external dependency)
const envPath = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

module.exports = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    phone: process.env.ADMIN_PHONE || '+94770000000',
  },
  sms: {
    provider: process.env.SMS_PROVIDER || 'console',
    apiUrl: process.env.SMS_API_URL || '',
    apiKey: process.env.SMS_API_KEY || '',
    senderId: process.env.SMS_SENDER_ID || 'CHQ-ALERT',
  },
  alertCron: process.env.ALERT_CRON || '0 8 * * *',
  backupCron: process.env.BACKUP_CRON || '0 2 * * *',
  backupKeep: parseInt(process.env.BACKUP_KEEP || '14', 10),
  dataDir: path.join(__dirname, '..', '..', 'data'),
};
