// Business layer: supplier CRUD with validation + activity logging.
const repo = require('../repositories/supplierRepository');
const activityRepo = require('../repositories/activityLogRepository');
const { AppError } = require('../utils/errors');
const { requireFields } = require('../utils/validators');

function normalise(d) {
  return {
    name: (d.name || '').trim(),
    contact_person: d.contact_person || null,
    phone: d.phone || null,
    email: d.email || null,
    address: d.address || null,
    bank_name: d.bank_name || null,
    notes: d.notes || null,
  };
}

module.exports = {
  list(q) { return repo.findAll(q); },
  get(id) {
    const s = repo.findById(id);
    if (!s) throw new AppError('Supplier not found.', 404);
    return s;
  },
  create(data, userId) {
    requireFields(data, ['name']);
    const info = repo.create(normalise(data));
    activityRepo.log({ userId, action: 'create', entityType: 'supplier', entityId: info.lastInsertRowid, details: { name: data.name } });
    return this.get(info.lastInsertRowid);
  },
  update(id, data, userId) {
    this.get(id);
    requireFields(data, ['name']);
    repo.update(id, normalise(data));
    activityRepo.log({ userId, action: 'update', entityType: 'supplier', entityId: id, details: { name: data.name } });
    return this.get(id);
  },
  remove(id, userId) {
    const s = this.get(id);
    // Suppliers with transaction history are deactivated (soft delete) so that
    // purchases/cheques keep their references; clean suppliers are hard-deleted.
    if (repo.hasRecords(id)) {
      repo.deactivate(id);
      activityRepo.log({ userId, action: 'deactivate', entityType: 'supplier', entityId: id, details: { name: s.name } });
      return { deactivated: true };
    }
    repo.hardDelete(id);
    activityRepo.log({ userId, action: 'delete', entityType: 'supplier', entityId: id, details: { name: s.name } });
    return { deleted: true };
  },
};
