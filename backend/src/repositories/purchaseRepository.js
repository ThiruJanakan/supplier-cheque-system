// Data-access layer: purchases. paid_amount is derived from cheque allocations
// (only cheques that are not bounced/cancelled count toward settlement).
const { db } = require('../config/database');

const BASE = `
  SELECT p.*, s.name AS supplier_name,
    IFNULL((SELECT SUM(a.allocated_amount) FROM cheque_allocations a
            JOIN cheques c ON c.id = a.cheque_id
            WHERE a.purchase_id = p.id AND c.status NOT IN ('bounced','cancelled')), 0) AS paid_amount
  FROM purchases p JOIN suppliers s ON s.id = p.supplier_id`;

module.exports = {
  findAll({ supplierId, from, to, search } = {}) {
    const where = []; const params = {};
    if (supplierId) { where.push('p.supplier_id = @supplierId'); params.supplierId = supplierId; }
    if (from) { where.push('p.purchase_date >= @from'); params.from = from; }
    if (to)   { where.push('p.purchase_date <= @to'); params.to = to; }
    if (search) { where.push('(p.invoice_no LIKE @q OR p.description LIKE @q OR s.name LIKE @q)'); params.q = `%${search}%`; }
    return db.prepare(`${BASE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.purchase_date DESC, p.id DESC`).all(params);
  },
  findById(id) { return db.prepare(`${BASE} WHERE p.id = ?`).get(id); },
  create(d) {
    return db.prepare(`INSERT INTO purchases (supplier_id, invoice_no, description, total_amount, purchase_date)
      VALUES (@supplier_id,@invoice_no,@description,@total_amount,@purchase_date)`).run(d);
  },
  update(id, d) {
    return db.prepare(`UPDATE purchases SET supplier_id=@supplier_id, invoice_no=@invoice_no,
      description=@description, total_amount=@total_amount, purchase_date=@purchase_date WHERE id=@id`).run({ ...d, id });
  },
  delete(id) { return db.prepare('DELETE FROM purchases WHERE id=?').run(id); },
  allocationCount(id) { return db.prepare('SELECT COUNT(*) c FROM cheque_allocations WHERE purchase_id=?').get(id).c; },
};
