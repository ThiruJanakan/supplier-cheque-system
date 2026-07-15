// Data-access layer: revenue entries + savings ledger.
const { db } = require('../config/database');

module.exports = {
  // Revenue -----------------------------------------------------------------
  revenueList({ from, to } = {}) {
    const where = []; const params = {};
    if (from) { where.push('entry_date >= @from'); params.from = from; }
    if (to)   { where.push('entry_date <= @to'); params.to = to; }
    return db.prepare(`SELECT * FROM revenue_entries ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY entry_date DESC, id DESC`).all(params);
  },
  revenueCreate(d) {
    return db.prepare('INSERT INTO revenue_entries (entry_date, amount, notes) VALUES (@entry_date,@amount,@notes)').run(d);
  },
  revenueById(id) { return db.prepare('SELECT * FROM revenue_entries WHERE id=?').get(id); },
  revenueDelete(id) { return db.prepare('DELETE FROM revenue_entries WHERE id=?').run(id); },

  // Savings ledger ------------------------------------------------------------
  balance() {
    const row = db.prepare('SELECT balance_after FROM savings_transactions ORDER BY id DESC LIMIT 1').get();
    return row ? row.balance_after : 0;
  },
  addTransaction({ type, amount, reference }) {
    const balanceAfter = this.balance() + amount;
    db.prepare('INSERT INTO savings_transactions (type, amount, balance_after, reference) VALUES (?,?,?,?)')
      .run(type, amount, balanceAfter, reference || null);
    return balanceAfter;
  },
  transactions({ limit = 200 } = {}) {
    return db.prepare('SELECT * FROM savings_transactions ORDER BY id DESC LIMIT ?').all(limit);
  },
  totals() {
    return db.prepare(`SELECT
      IFNULL(SUM(CASE WHEN amount > 0 THEN amount END), 0) AS total_deposits,
      IFNULL(SUM(CASE WHEN amount < 0 THEN -amount END), 0) AS total_withdrawals
      FROM savings_transactions`).get();
  },
};
