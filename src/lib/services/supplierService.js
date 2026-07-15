import { logActivity } from './activityLogService';

function normalise(d) {
  return {
    name: (d.name || '').trim(),
    contact_person: d.contact_person || null,
    phone: d.phone || null,
    email: d.email || null,
    address: d.address || null,
    bank_name: d.bank_name || null,
    bank_account_no: d.bank_account_no || null,
    branch_name: d.branch_name || null,
    branch_code: d.branch_code || null,
    notes: d.notes || null,
  };
}

export async function listSuppliers(supabase, { search = '', includeInactive = false } = {}) {
  let query = supabase
    .from('suppliers')
    .select(`
      *,
      purchases:purchases(total_amount),
      cheques:cheques(amount, status)
    `)
    .order('name');

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,contact_person.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return data.map(s => {
    const total_purchases = s.purchases.reduce((sum, p) => sum + Number(p.total_amount), 0);
    const total_cheques = s.cheques
      .filter(c => !['cancelled', 'bounced'].includes(c.status))
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const sCopy = { ...s };
    delete sCopy.purchases;
    delete sCopy.cheques;

    return {
      ...sCopy,
      total_purchases,
      total_cheques
    };
  });
}

export async function getSupplier(supabase, id) {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Supplier not found.');
  return data;
}

export async function createSupplier(supabase, data, user = {}) {
  if (!data.name || !data.name.trim()) throw new Error('Supplier name is required.');
  
  const norm = normalise(data);
  const { data: newSupplier, error } = await supabase
    .from('suppliers')
    .insert(norm)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    userId: user.id,
    username: user.email ? user.email.split('@')[0] : 'admin',
    action: 'create',
    entityType: 'supplier',
    entityId: newSupplier.id,
    details: { name: norm.name }
  });

  return newSupplier;
}

export async function updateSupplier(supabase, id, data, user = {}) {
  // Ensure exists
  await getSupplier(supabase, id);
  
  if (!data.name || !data.name.trim()) throw new Error('Supplier name is required.');
  
  const norm = normalise(data);
  const { data: updatedSupplier, error } = await supabase
    .from('suppliers')
    .update({ ...norm, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    userId: user.id,
    username: user.email ? user.email.split('@')[0] : 'admin',
    action: 'update',
    entityType: 'supplier',
    entityId: id,
    details: { name: norm.name }
  });

  return updatedSupplier;
}

export async function removeSupplier(supabase, id, user = {}) {
  const supplier = await getSupplier(supabase, id);

  // Check if supplier has associated purchases or cheques
  const { count: purchaseCount, error: errP } = await supabase
    .from('purchases')
    .select('*', { count: 'exact', head: true })
    .eq('supplier_id', id);

  const { count: chequeCount, error: errC } = await supabase
    .from('cheques')
    .select('*', { count: 'exact', head: true })
    .eq('supplier_id', id);

  if (errP || errC) throw new Error('Error checking supplier transaction history.');

  const hasHistory = (purchaseCount || 0) + (chequeCount || 0) > 0;
  const username = user.email ? user.email.split('@')[0] : 'admin';

  if (hasHistory) {
    // Soft delete / deactivate
    const { error } = await supabase
      .from('suppliers')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);

    await logActivity(supabase, {
      userId: user.id,
      username,
      action: 'deactivate',
      entityType: 'supplier',
      entityId: id,
      details: { name: supplier.name }
    });

    return { deactivated: true };
  }

  // Hard delete
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    userId: user.id,
    username,
    action: 'delete',
    entityType: 'supplier',
    entityId: id,
    details: { name: supplier.name }
  });

  return { deleted: true };
}
