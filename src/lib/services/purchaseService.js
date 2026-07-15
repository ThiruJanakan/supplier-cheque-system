import { logActivity } from './activityLogService';
import { getSupplier } from './supplierService';

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

  return {
    supplier_id: Number(d.supplier_id),
    invoice_no: d.invoice_no || null,
    description: d.description || null,
    total_amount: totalAmount,
    purchase_date: d.purchase_date,
  };
}

export async function listPurchases(supabase, { supplierId, from, to, search } = {}) {
  let query = supabase
    .from('purchases')
    .select(`
      *,
      supplier:suppliers(name),
      allocations:cheque_allocations(
        allocated_amount,
        cheque:cheques(status)
      )
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

  return data.map(p => {
    const paid_amount = p.allocations
      .filter(a => a.cheque && !['bounced', 'cancelled'].includes(a.cheque.status))
      .reduce((sum, a) => sum + Number(a.allocated_amount), 0);

    const pCopy = { ...p };
    delete pCopy.supplier;
    delete pCopy.allocations;

    return {
      ...pCopy,
      supplier_name: p.supplier ? p.supplier.name : '',
      paid_amount,
      outstanding: Number((Number(p.total_amount) - paid_amount).toFixed(2))
    };
  });
}

export async function getPurchase(supabase, id) {
  const { data, error } = await supabase
    .from('purchases')
    .select(`
      *,
      supplier:suppliers(name),
      allocations:cheque_allocations(
        allocated_amount,
        cheque:cheques(status)
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Purchase not found.');

  const paid_amount = data.allocations
    .filter(a => a.cheque && !['bounced', 'cancelled'].includes(a.cheque.status))
    .reduce((sum, a) => sum + Number(a.allocated_amount), 0);

  const pCopy = { ...data };
  delete pCopy.supplier;
  delete pCopy.allocations;

  return {
    ...pCopy,
    supplier_name: data.supplier ? data.supplier.name : '',
    paid_amount,
    outstanding: Number((Number(data.total_amount) - paid_amount).toFixed(2))
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
