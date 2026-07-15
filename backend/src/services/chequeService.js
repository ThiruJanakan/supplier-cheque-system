// Business layer: cheque lifecycle, partial-payment allocations, and the
// side effects of status changes (SMS notifications, savings deduction on
// clearance). This is the core domain logic of the system.
const { db } = require('../config/database');
const repo = require('../repositories/chequeRepository');
const purchaseRepo = require('../repositories/purchaseRepository');
const supplierRepo = require('../repositories/supplierRepository');
const financeRepo = require('../repositories/financeRepository');
const activityRepo = require('../repositories/activityLogRepository');
const smsService = require('./smsService');
const { AppError } = require('../utils/errors');
const { requireFields, validDate, positiveNumber } = require('../utils/validators');

const TRANSITIONS = {
  issued:         ['pending', 'partially_paid', 'cleared', 'bounced', 'cancelled'],
  pending:        ['partially_paid', 'cleared', 'bounced', 'cancelled'],
  partially_paid: ['pending', 'cleared', 'bounced', 'cancelled'],
  cleared:        [],                    // terminal
  bounced:        ['pending'],           // can be re-presented
  cancelled:      [],                    // terminal
};

function validate(d, existingId = null) {
  requireFields(d, ['cheque_number', 'supplier_id', 'amount', 'issue_date', 'due_date']);
  validDate(d.issue_date, 'Issue date');
  validDate(d.due_date, 'Due date');
  if (d.due_date < d.issue_date) throw new AppError('Due date cannot be before the issue date.');
  d.amount = positiveNumber(d.amount, 'Cheque amount');
  if (!supplierRepo.findById(d.supplier_id)) throw new AppError('Supplier does not exist.');
  const dup = repo.findByNumber(String(d.cheque_number).trim());
  if (dup && dup.id !== existingId) throw new AppError(`Cheque number "${d.cheque_number}" already exists.`, 409);
  return {
    cheque_number: String(d.cheque_number).trim(), supplier_id: d.supplier_id, amount: d.amount,
    issue_date: d.issue_date, due_date: d.due_date, bank_name: d.bank_name || null, notes: d.notes || null,
  };
}

function applyAllocations(chequeId, cheque, allocations) {
  // allocations: [{ purchase_id, allocated_amount }]
  const total = allocations.reduce((s, a) => s + positiveNumber(a.allocated_amount, 'Allocation amount'), 0);
  if (total - cheque.amount > 0.005) {
    throw new AppError(`Allocations (${total.toFixed(2)}) exceed the cheque amount (${cheque.amount.toFixed(2)}).`);
  }
  repo.clearAllocations(chequeId);
  for (const a of allocations) {
    const p = purchaseRepo.findById(a.purchase_id);
    if (!p) throw new AppError(`Purchase #${a.purchase_id} not found.`);
    if (p.supplier_id !== cheque.supplier_id) {
      throw new AppError(`Purchase #${a.purchase_id} belongs to a different supplier.`);
    }
    // Do not allow paying more than what is still outstanding on the purchase.
    const alreadyPaid = p.paid_amount;
    const outstanding = p.total_amount - alreadyPaid;
    if (a.allocated_amount - outstanding > 0.005) {
      throw new AppError(`Allocation of ${a.allocated_amount} to invoice ${p.invoice_no || '#' + p.id} exceeds its outstanding balance (${outstanding.toFixed(2)}).`);
    }
    repo.addAllocation(chequeId, a.purchase_id, a.allocated_amount);
  }
}

module.exports = {
  list(q) { return repo.findAll(q); },
  get(id) {
    const c = repo.findById(id);
    if (!c) throw new AppError('Cheque not found.', 404);
    return { ...c, allocations: repo.allocations(id) };
  },

  create(data, userId) {
    const d = validate(data);
    d.status = 'issued';
    const tx = db.transaction(() => {
      const info = repo.create(d);
      const id = info.lastInsertRowid;
      if (Array.isArray(data.allocations) && data.allocations.length) {
        applyAllocations(id, d, data.allocations);
      }
      return id;
    });
    const id = tx();
    activityRepo.log({ userId, action: 'create', entityType: 'cheque', entityId: id, details: { cheque_number: d.cheque_number, amount: d.amount } });
    return this.get(id);
  },

  update(id, data, userId) {
    const existing = this.get(id);
    if (['cleared', 'cancelled'].includes(existing.status)) {
      throw new AppError(`A ${existing.status} cheque cannot be edited.`);
    }
    const d = validate(data, id);
    const tx = db.transaction(() => {
      repo.update(id, d);
      if (Array.isArray(data.allocations)) applyAllocations(id, d, data.allocations);
    });
    tx();
    activityRepo.log({ userId, action: 'update', entityType: 'cheque', entityId: id, details: { cheque_number: d.cheque_number } });
    return this.get(id);
  },

  async setStatus(id, status, userId) {
    const cheque = this.get(id);
    const allowed = TRANSITIONS[cheque.status] || [];
    if (!allowed.includes(status)) {
      throw new AppError(`Cannot change status from "${cheque.status}" to "${status}".`);
    }
    if (status === 'cleared') {
      // Clearing a cheque draws the funds from the savings account.
      const balance = financeRepo.balance();
      if (balance < cheque.amount) {
        throw new AppError(`Insufficient savings balance (${balance.toFixed(2)}) to clear this cheque (${cheque.amount.toFixed(2)}).`);
      }
      financeRepo.addTransaction({ type: 'cheque_clearance', amount: -cheque.amount, reference: `Cheque ${cheque.cheque_number}` });
    }
    repo.setStatus(id, status);
    activityRepo.log({ userId, action: 'status_change', entityType: 'cheque', entityId: id, details: { from: cheque.status, to: status } });

    const updated = this.get(id);
    if (status === 'cleared') await smsService.sendChequeAlert('cleared', updated);
    if (status === 'bounced') await smsService.sendChequeAlert('bounced', updated);
    return updated;
  },

  remove(id, userId) {
    const c = this.get(id);
    if (!['issued', 'cancelled'].includes(c.status)) {
      throw new AppError('Only issued or cancelled cheques can be deleted. Cancel the cheque instead to keep the audit trail.');
    }
    repo.delete(id);
    activityRepo.log({ userId, action: 'delete', entityType: 'cheque', entityId: id, details: { cheque_number: c.cheque_number } });
    return { deleted: true };
  },
};
