// Business layer: purchase transactions.
const repo = require('../repositories/purchaseRepository');
const supplierRepo = require('../repositories/supplierRepository');
const activityRepo = require('../repositories/activityLogRepository');
const { AppError } = require('../utils/errors');
const { requireFields, validDate, positiveNumber } = require('../utils/validators');

function validate(d) {
  requireFields(d, ['supplier_id', 'total_amount', 'purchase_date']);
  validDate(d.purchase_date, 'Purchase date');
  d.total_amount = positiveNumber(d.total_amount, 'Total amount');
  if (!supplierRepo.findById(d.supplier_id)) throw new AppError('Supplier does not exist.');
  return {
    supplier_id: d.supplier_id, invoice_no: d.invoice_no || null,
    description: d.description || null, total_amount: d.total_amount, purchase_date: d.purchase_date,
  };
}

module.exports = {
  list(q) { return repo.findAll(q); },
  get(id) {
    const p = repo.findById(id);
    if (!p) throw new AppError('Purchase not found.', 404);
    return { ...p, outstanding: +(p.total_amount - p.paid_amount).toFixed(2) };
  },
  create(data, userId) {
    const d = validate(data);
    const info = repo.create(d);
    activityRepo.log({ userId, action: 'create', entityType: 'purchase', entityId: info.lastInsertRowid, details: { invoice: d.invoice_no, amount: d.total_amount } });
    return this.get(info.lastInsertRowid);
  },
  update(id, data, userId) {
    this.get(id);
    const d = validate(data);
    repo.update(id, d);
    activityRepo.log({ userId, action: 'update', entityType: 'purchase', entityId: id, details: { amount: d.total_amount } });
    return this.get(id);
  },
  remove(id, userId) {
    this.get(id);
    if (repo.allocationCount(id) > 0) {
      throw new AppError('This purchase has cheque payments allocated to it. Remove or reallocate those cheques first.');
    }
    repo.delete(id);
    activityRepo.log({ userId, action: 'delete', entityType: 'purchase', entityId: id });
    return { deleted: true };
  },
};
