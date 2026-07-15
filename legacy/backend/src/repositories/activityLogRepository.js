// Data-access layer: system activity trail.
const { db } = require('../config/database');

module.exports = {
  log({ userId = null, action, entityType, entityId = null, details = null }) {
    db.prepare('INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES (?,?,?,?,?)')
      .run(userId, action, entityType, entityId, details ? JSON.stringify(details) : null);
  },
  findAll({ entityType, limit = 300 } = {}) {
    const where = []; const params = { limit };
    if (entityType) { where.push('a.entity_type = @entityType'); params.entityType = entityType; }
    return db.prepare(`SELECT a.*, u.username FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.id DESC LIMIT @limit`).all(params);
  },
};
