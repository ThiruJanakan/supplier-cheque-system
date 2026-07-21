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

// First and last day of a YYYY-MM month as YYYY-MM-DD strings.
export function monthBounds(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Month must be in YYYY-MM format.');
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

export async function listSuppliers(supabase, { search = '', includeInactive = false, month = '' } = {}) {
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

  if (month) {
    // Restrict the embedded purchase/cheque rows so the totals reflect only this month.
    const { from, to } = monthBounds(month);
    query = query
      .gte('purchases.purchase_date', from).lte('purchases.purchase_date', to)
      .gte('cheques.issue_date', from).lte('cheques.issue_date', to);
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

function validateSupplier(data) {
  if (!data.name || !data.name.trim()) throw new Error('Supplier name is required.');
  if (data.phone) {
    const cleanPhone = String(data.phone).trim();
    if (cleanPhone && !/^\+?[0-9\s\-()]{7,20}$/.test(cleanPhone)) {
      throw new Error('Phone number must be a valid format (7-20 digits).');
    }
  }
  if (data.email) {
    const cleanEmail = String(data.email).trim();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Email address must be a valid format.');
    }
  }
  if (data.bank_account_no) {
    const cleanBankNo = String(data.bank_account_no).trim();
    if (cleanBankNo && !/^\d+$/.test(cleanBankNo)) {
      throw new Error('Bank account number must contain only numbers.');
    }
  }
}

export async function createSupplier(supabase, data, user = {}) {
  validateSupplier(data);
  
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
  validateSupplier(data);
  
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
