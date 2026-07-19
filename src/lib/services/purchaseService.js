import { logActivity } from './activityLogService';
import { getSupplier } from './supplierService';

// Add `n` days to a YYYY-MM-DD string, returning YYYY-MM-DD (UTC-safe).
function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Whole days from today (UTC) until `dateStr`. Negative = overdue.
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  const target = new Date(`${dateStr}T00:00:00Z`);
  return Math.round((target - today) / 86400000);
}

// Credit status for a purchase, given its outstanding balance and due date.
export function creditStatus(outstanding, dueDate) {
  if (outstanding <= 0.005) return 'settled';
  if (!dueDate) return 'open';
  const d = daysUntil(dueDate);
  if (d < 0) return 'overdue';
  if (d <= 3) return 'due_soon';
  return 'upcoming';
}

function validate(d) {
  if (!d.supplier_id) throw new Error('Supplier is required.');
  if (d.total_amount === undefined || d.total_amount === null) throw new Error('Total amount is required.');
  const totalAmount = Number(d.total_amount);
  if (isNaN(totalAmount) || totalAmount <= 0) throw new Error('Total amount must be a positive number.');
  if (!d.purchase_date) throw new Error('Purchase date is required.');

  // Format check YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.purchase_date)) {
    throw new Error('Purchase date must be a valid date in YYYY-MM-DD format.');
  }

  // Credit period is optional. null/'' => no credit term (due immediately, no due date).
  let creditPeriodDays = null;
  let dueDate = null;
  if (d.credit_period_days !== undefined && d.credit_period_days !== null && d.credit_period_days !== '') {
    creditPeriodDays = Number(d.credit_period_days);
    if (isNaN(creditPeriodDays) || creditPeriodDays < 0 || !Number.isInteger(creditPeriodDays)) {
      throw new Error('Credit period must be a whole number of days (0 or more).');
    }
    dueDate = addDays(d.purchase_date, creditPeriodDays);
  }

  return {
    supplier_id: Number(d.supplier_id),
    invoice_no: d.invoice_no || null,
    description: d.description || null,
    total_amount: totalAmount,
    purchase_date: d.purchase_date,
    credit_period_days: creditPeriodDays,
    due_date: dueDate,
  };
}

// Sum non-bounced/cancelled cheque allocations for a purchase row shape.
function chequePaid(allocations) {
  return (allocations || [])
    .filter(a => a.cheque && !['bounced', 'cancelled'].includes(a.cheque.status))
    .reduce((sum, a) => sum + Number(a.allocated_amount), 0);
}

function paymentsPaid(payments) {
  return (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
}

export async function listPurchases(supabase, { supplierId, from, to, search, pendingOnly } = {}) {
  let query = supabase
    .from('purchases')
    .select(`
      *,
      supplier:suppliers(name),
      allocations:cheque_allocations(
        allocated_amount,
        cheque:cheques(status)
      ),
      payments:purchase_payments(amount)
    `)
    .order('purchase_date', { ascending: false })
    .order('id', { ascending: false });

  if (supplierId) {
    query = query.eq('supplier_id', supplierId);
  }
  if (from) {
    query = query.gte('purchase_date', from);
  }
  if (to) {
    query = query.lte('purchase_date', to);
  }
  if (search) {
    query = query.or(`invoice_no.ilike.%${search}%,description.ilike.%${search}%,suppliers.name.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data.map(p => {
    const paid_amount = chequePaid(p.allocations) + paymentsPaid(p.payments);
    const outstanding = Number((Number(p.total_amount) - paid_amount).toFixed(2));

    const pCopy = { ...p };
    delete pCopy.supplier;
    delete pCopy.allocations;
    delete pCopy.payments;

    return {
      ...pCopy,
      supplier_name: p.supplier ? p.supplier.name : '',
      paid_amount,
      outstanding,
      days_to_due: daysUntil(p.due_date),
      status: creditStatus(outstanding, p.due_date),
    };
  });

  return pendingOnly ? rows.filter(r => r.outstanding > 0.005) : rows;
}

export async function getPurchase(supabase, id) {
  const { data, error } = await supabase
    .from('purchases')
    .select(`
      *,
      supplier:suppliers(*),
      allocations:cheque_allocations(
        id,
        allocated_amount,
        cheque:cheques(id, cheque_number, status, due_date, bank_name)
      ),
      payments:purchase_payments(*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Purchase not found.');

  const paid_cheques = chequePaid(data.allocations);
  const paid_payments = paymentsPaid(data.payments);
  const paid_amount = paid_cheques + paid_payments;
  const outstanding = Number((Number(data.total_amount) - paid_amount).toFixed(2));

  const supplier = data.supplier || null;
  const allocations = (data.allocations || []).map(a => ({
    id: a.id,
    allocated_amount: Number(a.allocated_amount),
    cheque_id: a.cheque ? a.cheque.id : null,
    cheque_number: a.cheque ? a.cheque.cheque_number : null,
    cheque_status: a.cheque ? a.cheque.status : null,
    cheque_due_date: a.cheque ? a.cheque.due_date : null,
    bank_name: a.cheque ? a.cheque.bank_name : null,
  }));
  const payments = (data.payments || [])
    .map(p => ({ ...p, amount: Number(p.amount) }))
    .sort((a, b) => (a.paid_on < b.paid_on ? 1 : -1));

  const pCopy = { ...data };
  delete pCopy.supplier;
  delete pCopy.allocations;
  delete pCopy.payments;

  return {
    ...pCopy,
    supplier,
    supplier_name: supplier ? supplier.name : '',
    paid_amount,
    paid_cheques,
    paid_payments,
    outstanding,
    days_to_due: daysUntil(data.due_date),
    status: creditStatus(outstanding, data.due_date),
    allocations,
    payments,
  };
}

export async function createPurchase(supabase, data, user = {}) {
  const norm = validate(data);

  // Verify supplier exists
  await getSupplier(supabase, norm.supplier_id);

  const { data: newPurchase, error } = await supabase
    .from('purchases')
    .insert(norm)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    userId: user.id,
    username: user.email ? user.email.split('@')[0] : 'admin',
    action: 'create',
    entityType: 'purchase',
    entityId: newPurchase.id,
    details: { invoice: norm.invoice_no, amount: norm.total_amount }
  });

  return getPurchase(supabase, newPurchase.id);
}

export async function updatePurchase(supabase, id, data, user = {}) {
  // Ensure exists
  await getPurchase(supabase, id);

  const norm = validate(data);

  // Verify supplier exists
  await getSupplier(supabase, norm.supplier_id);

  const { data: updatedPurchase, error } = await supabase
    .from('purchases')
    .update(norm)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    userId: user.id,
    username: user.email ? user.email.split('@')[0] : 'admin',
    action: 'update',
    entityType: 'purchase',
    entityId: id,
    details: { amount: norm.total_amount }
  });

  return getPurchase(supabase, id);
}

export async function removePurchase(supabase, id, user = {}) {
  await getPurchase(supabase, id);

  // Check if purchase has cheque allocations
  const { count: allocationCount, error: errA } = await supabase
    .from('cheque_allocations')
    .select('*', { count: 'exact', head: true })
    .eq('purchase_id', id);

  if (errA) throw new Error('Error checking cheque allocations.');

  if ((allocationCount || 0) > 0) {
    throw new Error('This purchase has cheque payments allocated to it. Remove or reallocate those cheques first.');
  }

  // purchase_payments cascade-delete with the purchase (FK on delete cascade).
  const { error } = await supabase
    .from('purchases')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    userId: user.id,
    username: user.email ? user.email.split('@')[0] : 'admin',
    action: 'delete',
    entityType: 'purchase',
    entityId: id
  });

  return { deleted: true };
}

// ============================================================
// Direct payments (cash / cheque / bank transfer) on a purchase
// ============================================================

function validatePayment(d) {
  const amount = Number(d.amount);
  if (isNaN(amount) || amount <= 0) throw new Error('Payment amount must be a positive number.');
  if (!d.paid_on) throw new Error('Payment date is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.paid_on)) throw new Error('Payment date must be in YYYY-MM-DD format.');
  const method = d.method || 'cash';
  if (!['cash', 'cheque', 'bank_transfer'].includes(method)) {
    throw new Error('Payment method must be cash, cheque or bank_transfer.');
  }
  return {
    amount: Number(amount.toFixed(2)),
    method,
    reference: d.reference || null,
    paid_on: d.paid_on,
    notes: d.notes || null,
  };
}

export async function listPurchasePayments(supabase, purchaseId) {
  const { data, error } = await supabase
    .from('purchase_payments')
    .select('*')
    .eq('purchase_id', purchaseId)
    .order('paid_on', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(p => ({ ...p, amount: Number(p.amount) }));
}

// Guard: the sum of direct payments must never push total paid past the purchase total.
async function assertWithinTotal(supabase, purchase, addAmount, excludePaymentId = null) {
  const chequePart = purchase.paid_cheques;
  const otherPayments = purchase.payments
    .filter(p => p.id !== excludePaymentId)
    .reduce((s, p) => s + Number(p.amount), 0);
  const projected = chequePart + otherPayments + addAmount;
  if (projected - Number(purchase.total_amount) > 0.005) {
    const room = Number(purchase.total_amount) - chequePart - otherPayments;
    throw new Error(`Payment exceeds the outstanding balance. At most ${room.toFixed(2)} can be recorded.`);
  }
}

export async function addPurchasePayment(supabase, purchaseId, data, user = {}) {
  const purchase = await getPurchase(supabase, purchaseId);
  const norm = validatePayment(data);
  await assertWithinTotal(supabase, purchase, norm.amount);

  const { error } = await supabase
    .from('purchase_payments')
    .insert({ purchase_id: purchaseId, ...norm });
  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    userId: user.id,
    username: user.email ? user.email.split('@')[0] : 'admin',
    action: 'create',
    entityType: 'purchase_payment',
    entityId: purchaseId,
    details: { amount: norm.amount, method: norm.method }
  });

  return getPurchase(supabase, purchaseId);
}

export async function updatePurchasePayment(supabase, purchaseId, paymentId, data, user = {}) {
  const purchase = await getPurchase(supabase, purchaseId);
  const existing = purchase.payments.find(p => p.id === Number(paymentId));
  if (!existing) throw new Error('Payment not found.');

  const norm = validatePayment(data);
  await assertWithinTotal(supabase, purchase, norm.amount, Number(paymentId));

  const { error } = await supabase
    .from('purchase_payments')
    .update(norm)
    .eq('id', paymentId)
    .eq('purchase_id', purchaseId);
  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    userId: user.id,
    username: user.email ? user.email.split('@')[0] : 'admin',
    action: 'update',
    entityType: 'purchase_payment',
    entityId: purchaseId,
    details: { payment_id: Number(paymentId), amount: norm.amount }
  });

  return getPurchase(supabase, purchaseId);
}

export async function removePurchasePayment(supabase, purchaseId, paymentId, user = {}) {
  const purchase = await getPurchase(supabase, purchaseId);
  const existing = purchase.payments.find(p => p.id === Number(paymentId));
  if (!existing) throw new Error('Payment not found.');

  const { error } = await supabase
    .from('purchase_payments')
    .delete()
    .eq('id', paymentId)
    .eq('purchase_id', purchaseId);
  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    userId: user.id,
    username: user.email ? user.email.split('@')[0] : 'admin',
    action: 'delete',
    entityType: 'purchase_payment',
    entityId: purchaseId,
    details: { payment_id: Number(paymentId) }
  });

  return getPurchase(supabase, purchaseId);
}

// ============================================================
// Pending credit dues, grouped by supplier
// ============================================================

export async function listCreditDues(supabase, { supplierId } = {}) {
  const rows = await listPurchases(supabase, { supplierId, pendingOnly: true });

  // Sort by supplier name, then soonest due date first (nulls last), then date.
  rows.sort((a, b) => {
    const s = (a.supplier_name || '').localeCompare(b.supplier_name || '');
    if (s !== 0) return s;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return a.purchase_date.localeCompare(b.purchase_date);
  });

  // Group into per-supplier buckets with subtotals.
  const groupsMap = {};
  for (const r of rows) {
    const key = r.supplier_id;
    if (!groupsMap[key]) {
      groupsMap[key] = {
        supplier_id: r.supplier_id,
        supplier_name: r.supplier_name,
        rows: [],
        total: 0,
        paid: 0,
        outstanding: 0,
      };
    }
    const g = groupsMap[key];
    g.rows.push(r);
    g.total += Number(r.total_amount);
    g.paid += Number(r.paid_amount);
    g.outstanding += Number(r.outstanding);
  }

  const groups = Object.values(groupsMap).sort((a, b) => a.supplier_name.localeCompare(b.supplier_name));
  const grand = {
    total: rows.reduce((s, r) => s + Number(r.total_amount), 0),
    paid: rows.reduce((s, r) => s + Number(r.paid_amount), 0),
    outstanding: rows.reduce((s, r) => s + Number(r.outstanding), 0),
    count: rows.length,
  };

  return { rows, groups, grand };
}
