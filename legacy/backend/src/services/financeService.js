// Business layer: sales revenue entry with automatic savings deposit,
// balance tracking, and funds-availability view.
const { db } = require('../config/database');
const repo = require('../repositories/financeRepository');
const chequeRepo = require('../repositories/chequeRepository');
const activityRepo = require('../repositories/activityLogRepository');
const { AppError } = require('../utils/errors');
const { requireFields, validDate, positiveNumber } = require('../utils/validators');

module.exports = {
  listRevenue(q) { return repo.revenueList(q); },

  // Recording revenue automatically records the transfer into savings.
  recordRevenue(data, userId) {
    requireFields(data, ['entry_date', 'amount']);
    validDate(data.entry_date, 'Entry date');
    const amount = positiveNumber(data.amount, 'Amount');
    const tx = db.transaction(() => {
      const info = repo.revenueCreate({ entry_date: data.entry_date, amount, notes: data.notes || null });
      repo.addTransaction({ type: 'deposit', amount, reference: `Sales revenue ${data.entry_date} (#${info.lastInsertRowid})` });
      return info.lastInsertRowid;
    });
    const id = tx();
    activityRepo.log({ userId, action: 'create', entityType: 'revenue', entityId: id, details: { date: data.entry_date, amount } });
    return { id, balance: repo.balance() };
  },

  deleteRevenue(id, userId) {
    const entry = repo.revenueById(id);
    if (!entry) throw new AppError('Revenue entry not found.', 404);
    const tx = db.transaction(() => {
      repo.revenueDelete(id);
      repo.addTransaction({ type: 'adjustment', amount: -entry.amount, reference: `Reversal of revenue entry #${id}` });
    });
    tx();
    activityRepo.log({ userId, action: 'delete', entityType: 'revenue', entityId: id, details: { amount: entry.amount } });
    return { balance: repo.balance() };
  },

  account() {
    const balance = repo.balance();
    const { total_deposits, total_withdrawals } = repo.totals();
    // Funds committed to cheques that have not yet cleared
    const pending = chequeRepo.findAll().filter(c => ['issued', 'pending', 'partially_paid'].includes(c.status));
    const committed = pending.reduce((s, c) => s + c.amount, 0);
    return {
      balance,
      total_deposits,
      total_withdrawals,
      committed_to_pending_cheques: committed,
      available_after_commitments: +(balance - committed).toFixed(2),
      transactions: repo.transactions(),
    };
  },
};
