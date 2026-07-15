// Data-access layer: SMS delivery log.
const { db } = require('../config/database');

module.exports = {
  create(d) {
    return db.prepare(`INSERT INTO sms_logs (recipient, message, category, cheque_id, status, provider_ref, error)
      VALUES (@recipient,@message,@category,@cheque_id,@status,@provider_ref,@error)`).run(d);
  },
  findAll({ category, status, limit = 200 } = {}) {
    const where = []; const params = { limit };
    if (category) { where.push('category = @category'); params.category = category; }
    if (status) { where.push('status = @status'); params.status = status; }
    return db.prepare(`SELECT l.*, c.cheque_number FROM sms_logs l LEFT JOIN cheques c ON c.id = l.cheque_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY l.id DESC LIMIT @limit`).all(params);
  },
  markDelivered(id, providerRef) {
    return db.prepare("UPDATE sms_logs SET status='delivered', provider_ref=IFNULL(?, provider_ref) WHERE id=?").run(providerRef, id);
  },
};
