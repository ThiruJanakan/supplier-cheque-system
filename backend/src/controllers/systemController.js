const smsLogRepo = require('../repositories/smsLogRepository');
const activityRepo = require('../repositories/activityLogRepository');
const settingsRepo = require('../repositories/settingsRepository');
const backupService = require('../services/backupService');
const alertScheduler = require('../services/alertScheduler');
const smsService = require('../services/smsService');

exports.smsLogs = (req, res) => res.json(smsLogRepo.findAll({ category: req.query.category, status: req.query.status }));
exports.activityLogs = (req, res) => res.json(activityRepo.findAll({ entityType: req.query.entity_type }));
exports.getSettings = (req, res) => res.json(settingsRepo.all());
exports.updateSettings = (req, res) => {
  const allowed = ['alert_intervals', 'admin_phone', 'currency', 'overdue_alerts'];
  for (const key of allowed) if (req.body[key] !== undefined) settingsRepo.set(key, req.body[key]);
  activityRepo.log({ userId: req.user.id, action: 'update', entityType: 'settings', details: req.body });
  res.json(settingsRepo.all());
};
exports.backups = (req, res) => res.json(backupService.list());
exports.backupNow = (req, res, next) => {
  try {
    const file = backupService.backupNow();
    activityRepo.log({ userId: req.user.id, action: 'backup', entityType: 'system' });
    res.json({ file });
  } catch (e) { next(e); }
};
exports.runAlertSweep = async (req, res, next) => {
  try { await alertScheduler.runDueDateSweep(); res.json({ ok: true }); } catch (e) { next(e); }
};
exports.testSms = async (req, res, next) => {
  try {
    const settings = settingsRepo.all();
    res.json(await smsService.sendRaw({ recipient: settings.admin_phone, message: 'Test message from Cheque Manager.', category: 'test' }));
  } catch (e) { next(e); }
};
