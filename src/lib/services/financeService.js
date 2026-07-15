import { logActivity } from './activityLogService';

export async function listRevenue(supabase, { from, to } = {}) {
  let query = supabase
    .from('revenue_entries')
    .select('*')
    .order('entry_date', { ascending: false })
    .order('id', { ascending: false });

  if (from) {
    query = query.gte('entry_date', from);
  }
  if (to) {
    query = query.lte('entry_date', to);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getBalance(supabase) {
  const { data, error } = await supabase
    .from('savings_transactions')
    .select('balance_after')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? Number(data.balance_after) : 0;
}

export async function addTransaction(supabase, { type, amount, reference }) {
  const currentBalance = await getBalance(supabase);
  const balanceAfter = currentBalance + Number(amount);

  const { error } = await supabase
    .from('savings_transactions')
    .insert({
      type,
      amount: Number(amount),
      balance_after: balanceAfter,
      reference
    });

  if (error) throw new Error(error.message);
  return balanceAfter;
}

export async function recordRevenue(supabase, data, user = {}) {
  if (!data.entry_date) throw new Error('Entry date is required.');
  if (data.amount === undefined || data.amount === null) throw new Error('Amount is required.');
  const amount = Number(data.amount);
  if (isNaN(amount) || amount <= 0) throw new Error('Amount must be a positive number.');
  
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.entry_date)) {
    throw new Error('Entry date must be a valid date in YYYY-MM-DD format.');
  }

  // Insert revenue entry
  const { data: newRevenue, error: errRev } = await supabase
    .from('revenue_entries')
    .insert({
      entry_date: data.entry_date,
      amount,
      notes: data.notes || null
    })
    .select()
    .single();

  if (errRev) throw new Error(errRev.message);

  // Record auto-deposit into savings
  const balanceAfter = await addTransaction(supabase, {
    type: 'deposit',
    amount,
    reference: `Sales revenue ${data.entry_date} (#${newRevenue.id})`
  });

  const username = user.email ? user.email.split('@')[0] : 'admin';
  await logActivity(supabase, {
    userId: user.id,
    username,
    action: 'create',
    entityType: 'revenue',
    entityId: newRevenue.id,
    details: { date: data.entry_date, amount }
  });

  return { id: newRevenue.id, balance: balanceAfter };
}

export async function deleteRevenue(supabase, id, user = {}) {
  // Find revenue entry
  const { data: entry, error: errFind } = await supabase
    .from('revenue_entries')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (errFind) throw new Error(errFind.message);
  if (!entry) throw new Error('Revenue entry not found.');

  // Delete revenue entry
  const { error: errDel } = await supabase
    .from('revenue_entries')
    .delete()
    .eq('id', id);

  if (errDel) throw new Error(errDel.message);

  // Record reversal transaction in savings ledger
  const balanceAfter = await addTransaction(supabase, {
    type: 'adjustment',
    amount: -Number(entry.amount),
    reference: `Reversal of revenue entry #${id}`
  });

  const username = user.email ? user.email.split('@')[0] : 'admin';
  await logActivity(supabase, {
    userId: user.id,
    username,
    action: 'delete',
    entityType: 'revenue',
    entityId: id,
    details: { amount: entry.amount }
  });

  return { balance: balanceAfter };
}

export async function getAccountDetails(supabase) {
  const balance = await getBalance(supabase);

  // Get totals
  const { data: txs, error: errTxs } = await supabase
    .from('savings_transactions')
    .select('type, amount');

  if (errTxs) throw new Error(errTxs.message);

  let total_deposits = 0;
  let total_withdrawals = 0;
  txs.forEach(t => {
    const amt = Number(t.amount);
    if (amt > 0) total_deposits += amt;
    else if (amt < 0) total_withdrawals += (-amt);
  });

  // Fetch all transactions for the ledger
  const { data: ledger, error: errLedger } = await supabase
    .from('savings_transactions')
    .select('*')
    .order('id', { ascending: false })
    .limit(200);

  if (errLedger) throw new Error(errLedger.message);

  // Compute pending committed checks
  const { data: pendingCheques, error: errPending } = await supabase
    .from('cheques')
    .select('amount')
    .in('status', ['issued', 'pending', 'partially_paid']);

  if (errPending) throw new Error(errPending.message);

  const committed = pendingCheques.reduce((sum, c) => sum + Number(c.amount), 0);

  return {
    balance,
    total_deposits,
    total_withdrawals,
    committed_to_pending_cheques: committed,
    available_after_commitments: Number((balance - committed).toFixed(2)),
    transactions: ledger,
  };
}
