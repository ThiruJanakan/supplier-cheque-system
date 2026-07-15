// Scheduled jobs:
//  1. Daily due-date sweep -> SMS reminders at configured intervals (7/3/1
//     days by default) plus overdue warnings. A guard table ensures the same
//     reminder is never sent twice for a cheque.
//  2. Daily database backup with rotation.
const cron = require('node-cron');
const env = require('../config/env');
const chequeRepo = require('../repositories/chequeRepository');
const settingsRepo = require('../repositories/settingsRepository');
const smsService = require('./smsService');
const backupService = require('./backupService');

async function runDueDateSweep() {
  const intervals = (settingsRepo.get('alert_intervals') || '7,3,1')
    .split(',').map(s => parseInt(s.trim(), 10)).filter(n => n > 0);

  for (const days of intervals) {
    const category = `due_${days}`;
    for (const cheque of chequeRepo.dueWithinDays(days)) {
      if (chequeRepo.alertAlreadySent(cheque.id, category)) continue;
      const result = await smsService.sendChequeAlert(category, cheque);
      if (result.status !== 'failed') chequeRepo.markAlertSent(cheque.id, category);
    }
  }

  if ((settingsRepo.get('overdue_alerts') || '1') === '1') {
    const today = new Date().toISOString().slice(0, 10);
    for (const cheque of chequeRepo.overdue()) {
      const category = `overdue`;
      // Overdue warnings repeat at most once per day per cheque.
      if (chequeRepo.alertAlreadySent(cheque.id, `${category}:${today}`)) continue;
      const result = await smsService.sendChequeAlert(category, cheque);
      if (result.status !== 'failed') chequeRepo.markAlertSent(cheque.id, `${category}:${today}`);
    }
  }
}

function start() {
  cron.schedule(env.alertCron, () => {
    runDueDateSweep().catch(e => console.error('Alert sweep failed:', e));
  });
  cron.schedule(env.backupCron, () => {
    try { backupService.backupNow(); } catch (e) { console.error('Backup failed:', e); }
  });
  console.log(`Scheduler started (alerts: "${env.alertCron}", backups: "${env.backupCron}").`);
}

module.exports = { start, runDueDateSweep };
