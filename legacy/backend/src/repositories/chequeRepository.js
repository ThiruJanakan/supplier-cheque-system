// Data-access layer: cheques + allocations.
const { db } = require('../config/database');

const BASE = `
  SELECT c.*, s.name AS supplier_name,
    IFNULL((SELECT SUM(allocated_amount) FROM cheque_allocations a WHERE a.cheque_id = c.id), 0) AS allocated_amount
  FROM cheques c JOIN suppliers s ON s.id = c.supplier_id`;

module.exports = {
  findAll({ status, supplierId, search, dueFrom, dueTo } = {}) {
    const where = []; const params = {};
    if (status) { where.push('c.status = @status'); params.status = status; }
    if (supplierId) { where.push('c.supplier_id = @supplierId'); params.supplierId = supplierId; }
    if (dueFrom) { where.push('c.due_date >= @dueFrom'); params.dueFrom = dueFrom; }
    if (dueTo) { where.push('c.due_date <= @dueTo'); params.dueTo = dueTo; }
    if (search) { where.push('(c.cheque_number LIKE @q OR s.name LIKE @q OR c.bank_name LIKE @q)'); params.q = `%${search}%`; }
    return db.prepare(`${BASE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY c.due_date ASC, c.id DESC`).all(params);
  },
  findById(id) { return db.prepare(`${BASE} WHERE c.id = ?`).get(id); },
  findByNumber(no) { return db.prepare('SELECT * FROM cheques WHERE cheque_number = ?').get(no); },
  create(d) {
    return db.prepare(`INSERT INTO cheques (cheque_number, supplier_id, amount, issue_date, due_date, status, bank_name, notes)
      VALUES (@cheque_number,@supplier_id,@amount,@issue_date,@due_date,@status,@bank_name,@notes)`).run(d);
  },
  update(id, d) {
    return db.prepare(`UPDATE cheques SET cheque_number=@cheque_number, supplier_id=@supplier_id, amount=@amount,
      issue_date=@issue_date, due_date=@due_date, bank_name=@bank_name, notes=@notes, updated_at=datetime('now')
      WHERE id=@id`).run({ ...d, id });
  },
  setStatus(id, status) {
    return db.prepare("UPDATE cheques SET status=?, updated_at=datetime('now') WHERE id=?").run(status, id);
  },
  delete(id) { return db.prepare('DELETE FROM cheques WHERE id=?').run(id); },

  // --- allocations -------------------------------------------------------
  allocations(chequeId) {
    return db.prepare(`SELECT a.*, p.invoice_no, p.total_amount AS purchase_total, p.purchase_date
      FROM cheque_allocations a JOIN purchases p ON p.id = a.purchase_id WHERE a.cheque_id = ?`).all(chequeId);
  },
  clearAllocations(chequeId) { return db.prepare('DELETE FROM cheque_allocations WHERE cheque_id=?').run(chequeId); },
  addAllocation(chequeId, purchaseId, amount) {
    return db.prepare('INSERT INTO cheque_allocations (cheque_id, purchase_id, allocated_amount) VALUES (?,?,?)')
      .run(chequeId, purchaseId, amount);
  },

  // --- alert helpers ------------------------------------------------------
  dueWithinDays(days) {
    return db.prepare(`${BASE}
      WHERE c.status IN ('issued','pending','partially_paid')
        AND date(c.due_date) = date('now', '+' || ? || ' days')`).all(days);
  },
  overdue() {
    return db.prepare(`${BASE}
      WHERE c.status IN ('issued','pending','partially_paid') AND date(c.due_date) < date('now')`).all();
  },
  alertAlreadySent(chequeId, category) {
    return !!db.prepare('SELECT 1 FROM alerts_sent WHERE cheque_id=? AND category=?').get(chequeId, category);
  },
  markAlertSent(chequeId, category) {
    db.prepare('INSERT OR IGNORE INTO alerts_sent (cheque_id, category) VALUES (?,?)').run(chequeId, category);
  },
};
