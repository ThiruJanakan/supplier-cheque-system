import { logActivity } from './activityLogService';
import { getSupplier } from './supplierService';
import { getPurchase } from './purchaseService';
import { getBalance, addTransaction } from './financeService';
import { sendChequeAlert } from './smsService';

const TRANSITIONS = {
  issued:         ['pending', 'partially_paid', 'cleared', 'bounced', 'cancelled'],
  pending:        ['partially_paid', 'cleared', 'bounced', 'cancelled'],
  partially_paid: ['pending', 'cleared', 'bounced', 'cancelled'],
  cleared:        [],                    // terminal
  bounced:        ['pending'],           // can be re-presented
  cancelled:      [],                    // terminal
};

async function validate(supabase, d, existingId = null) {
  if (!d.cheque_number || !String(d.cheque_number).trim()) throw new Error('Cheque number is required.');
  if (!d.supplier_id) throw new Error('Supplier is required.');
  if (d.amount === undefined || d.amount === null) throw new Error('Cheque amount is required.');
  const amount = Number(d.amount);
  if (isNaN(amount) || amount <= 0) throw new Error('Cheque amount must be a positive number.');
  if (!d.issue_date) throw new Error('Issue date is required.');
  if (!d.due_date) throw new Error('Due date is required.');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.issue_date)) throw new Error('Issue date must be in YYYY-MM-DD format.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.due_date)) throw new Error('Due date must be in YYYY-MM-DD format.');
  if (d.due_date < d.issue_date) throw new Error('Due date cannot be before the issue date.');

  // Verify supplier exists
  await getSupplier(supabase, d.supplier_id);

  // Verify duplicate cheque number
  const chequeNo = String(d.cheque_number).trim();
  const { data: dup, error: errDup } = await supabase
    .from('cheques')
    .select('id')
    .eq('cheque_number', chequeNo)
    .maybeSingle();

  if (errDup) throw new Error(errDup.message);
  if (dup && dup.id !== existingId) {
    throw new Error(`Cheque number "${d.cheque_number}" already exists. Check-number must be unique.`);
  }

  return {
    cheque_number: chequeNo,
    supplier_id: Number(d.supplier_id),
    amount,
    issue_date: d.issue_date,
    due_date: d.due_date,
    bank_name: d.bank_name || null,
    notes: d.notes || null,
  };
}

async function applyAllocations(supabase, chequeId, cheque, allocations) {
  // allocations: [{ purchase_id, allocated_amount }]
  const total = allocations.reduce((sum, a) => sum + Number(a.allocated_amount), 0);
  if (total - cheque.amount > 0.005) {
    throw new Error(`Allocations (${total.toFixed(2)}) exceed the cheque amount (${cheque.amount.toFixed(2)}).`);
  }

  // 1. Delete existing allocations for this cheque first
  const { error: errClear } = await supabase
    .from('cheque_allocations')
    .delete()
    .eq('cheque_id', chequeId);

  if (errClear) throw new Error(errClear.message);

  // 2. Add new allocations
  for (const a of allocations) {
    const purchase = await getPurchase(supabase, a.purchase_id);
    if (purchase.supplier_id !== cheque.supplier_id) {
      throw new Error(`Purchase #${a.purchase_id} belongs to a different supplier.`);
    }

    // Since we cleared allocations first, purchase.paid_amount does NOT include this cheque's allocations anymore.
    const outstanding = purchase.total_amount - purchase.paid_amount;
    const allocatedAmt = Number(a.allocated_amount);
    if (allocatedAmt - outstanding > 0.005) {
      throw new Error(`Allocation of ${allocatedAmt} to invoice ${purchase.invoice_no || '#' + purchase.id} exceeds its outstanding balance (${outstanding.toFixed(2)}).`);
    }

    const { error: errInsert } = await supabase
      .from('cheque_allocations')
      .insert({
        cheque_id: chequeId,
        purchase_id: a.purchase_id,
        allocated_amount: allocatedAmt
      });

    if (errInsert) throw new Error(errInsert.message);
  }
}

export async function listCheques(supabase, { status, supplierId, search, dueFrom, dueTo } = {}) {
  let query = supabase
    .from('cheques')
    .select(`
      *,
      supplier:suppliers(name),
      allocations:cheque_allocations(allocated_amount)
    `)
    .order('due_date', { ascending: true })
    .order('id', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }
  if (supplierId) {
    query = query.eq('supplier_id', supplierId);
  }
  if (dueFrom) {
    query = query.gte('due_date', dueFrom);
  }
  if (dueTo) {
    query = query.lte('due_date', dueTo);
  }
  if (search) {
    query = query.or(`cheque_number.ilike.%${search}%,bank_name.ilike.%${search}%,suppliers.name.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return data.map(c => {
    const allocated_amount = c.allocations.reduce((sum, a) => sum + Number(a.allocated_amount), 0);
    const cCopy = { ...c };
    delete cCopy.supplier;
    delete cCopy.allocations;

    return {
      ...cCopy,
      supplier_name: c.supplier ? c.supplier.name : '',
      allocated_amount
    };
  });
}

export async function getCheque(supabase, id) {
  const { data, error } = await supabase
    .from('cheques')
    .select(`
      *,
      supplier:suppliers(name),
      allocations:cheque_allocations(
        *,
        purchase:purchases(
          invoice_no,
          total_amount,
          purchase_date
        )
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Cheque not found.');

  const allocated_amount = data.allocations.reduce((sum, a) => sum + Number(a.allocated_amount), 0);
  
  const formattedAllocations = data.allocations.map(a => ({
    id: a.id,
    cheque_id: a.cheque_id,
    purchase_id: a.purchase_id,
    allocated_amount: a.allocated_amount,
    created_at: a.created_at,
    invoice_no: a.purchase ? a.purchase.invoice_no : null,
    purchase_total: a.purchase ? a.purchase.total_amount : 0,
    purchase_date: a.purchase ? a.purchase.purchase_date : null
  }));

  const cCopy = { ...data };
  delete cCopy.supplier;
  delete cCopy.allocations;

  return {
    ...cCopy,
    supplier_name: data.supplier ? data.supplier.name : '',
    allocated_amount,
    allocations: formattedAllocations
  };
}

export async function createCheque(supabase, data, user = {}) {
  const norm = await validate(supabase, data);
  norm.status = 'issued';

  const { data: newCheque, error } = await supabase
    .from('cheques')
    .insert(norm)
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (Array.isArray(data.allocations) && data.allocations.length) {
    await applyAllocations(supabase, newCheque.id, norm, data.allocations);
  }

  const username = user.email ? user.email.split('@')[0] : 'admin';
  await logActivity(supabase, {
    userId: user.id,
    username,
    action: 'create',
    entityType: 'cheque',
    entityId: newCheque.id,
    details: { cheque_number: norm.cheque_number, amount: norm.amount }
  });

  return getCheque(supabase, newCheque.id);
}

export async function updateCheque(supabase, id, data, user = {}) {
  const existing = await getCheque(supabase, id);
  if (['cleared', 'cancelled'].includes(existing.status)) {
    throw new Error(`A ${existing.status} cheque cannot be edited.`);
  }

  const norm = await validate(supabase, data, id);

  const { error } = await supabase
    .from('cheques')
    .update({ ...norm, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);

  if (Array.isArray(data.allocations)) {
    await applyAllocations(supabase, id, norm, data.allocations);
  }

  const username = user.email ? user.email.split('@')[0] : 'admin';
  await logActivity(supabase, {
    userId: user.id,
    username,
    action: 'update',
    entityType: 'cheque',
    entityId: id,
    details: { cheque_number: norm.cheque_number }
  });

  return getCheque(supabase, id);
}

export async function setChequeStatus(supabase, id, status, user = {}) {
  const cheque = await getCheque(supabase, id);
  const allowed = TRANSITIONS[cheque.status] || [];
  if (!allowed.includes(status)) {
    throw new Error(`Cannot change status from "${cheque.status}" to "${status}".`);
  }

  if (status === 'cleared') {
    // Check savings account balance
    const balance = await getBalance(supabase);
    if (balance < cheque.amount) {
      throw new Error(`Insufficient savings balance (${balance.toFixed(2)}) to clear this cheque (${cheque.amount.toFixed(2)}).`);
    }
    // Deduct funds from ledger
    await addTransaction(supabase, {
      type: 'cheque_clearance',
      amount: -cheque.amount,
      reference: `Cheque ${cheque.cheque_number}`
    });
  }

  const { error } = await supabase
    .from('cheques')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);

  const username = user.email ? user.email.split('@')[0] : 'admin';
  await logActivity(supabase, {
    userId: user.id,
    username,
    action: 'status_change',
    entityType: 'cheque',
    entityId: id,
    details: { from: cheque.status, to: status }
  });

  const updated = await getCheque(supabase, id);
  if (status === 'cleared') await sendChequeAlert(supabase, 'cleared', updated);
  if (status === 'bounced') await sendChequeAlert(supabase, 'bounced', updated);

  return updated;
}

export async function removeCheque(supabase, id, user = {}) {
  const cheque = await getCheque(supabase, id);
  if (!['issued', 'cancelled'].includes(cheque.status)) {
    throw new Error('Only issued or cancelled cheques can be deleted. Cancel the cheque instead to keep the audit trail.');
  }

  const { error } = await supabase
    .from('cheques')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);

  const username = user.email ? user.email.split('@')[0] : 'admin';
  await logActivity(supabase, {
    userId: user.id,
    username,
    action: 'delete',
    entityType: 'cheque',
    entityId: id,
    details: { cheque_number: cheque.cheque_number }
  });

  return { deleted: true };
}
