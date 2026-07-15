// Data-access layer: suppliers. No business rules here, SQL only.
const { db } = require('../config/database');

module.exports = {
  findAll({ search = '', includeInactive = false } = {}) {
    const where = [];
    const params = {};
    if (!includeInactive) where.push('s.is_active = 1');
    if (search) { where.push('(s.name LIKE @q OR s.contact_person LIKE @q OR s.phone LIKE @q)'); params.q = `%${search}%`; }
    return db.prepare(`
      SELECT s.*,
        (SELECT IFNULL(SUM(total_amount),0) FROM purchases p WHERE p.supplier_id = s.id) AS total_purchases,
        (SELECT IFNULL(SUM(amount),0) FROM cheques c WHERE c.supplier_id = s.id AND c.status NOT IN ('cancelled','bounced')) AS total_cheques
      FROM suppliers s
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY s.name`).all(params);
  },
  findById(id) { return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id); },
  create(d) {
    return db.prepare(`INSERT INTO suppliers (name, contact_person, phone, email, address, bank_name, notes)
      VALUES (@name,@contact_person,@phone,@email,@address,@bank_name,@notes)`).run(d);
  },
  update(id, d) {
    return db.prepare(`UPDATE suppliers SET name=@name, contact_person=@contact_person, phone=@phone,
      email=@email, address=@address, bank_name=@bank_name, notes=@notes, updated_at=datetime('now')
      WHERE id=@id`).run({ ...d, id });
  },
  deactivate(id) { return db.prepare("UPDATE suppliers SET is_active=0, updated_at=datetime('now') WHERE id=?").run(id); },
  hardDelete(id) { return db.prepare('DELETE FROM suppliers WHERE id=?').run(id); },
  hasRecords(id) {
    const p = db.prepare('SELECT COUNT(*) c FROM purchases WHERE supplier_id=?').get(id).c;
    const c = db.prepare('SELECT COUNT(*) c FROM cheques WHERE supplier_id=?').get(id).c;
    return p + c > 0;
  },
};
