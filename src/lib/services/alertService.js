import { listCheques, getCheque } from './chequeService';
import { getSetting } from './settingsService';
import { sendChequeAlert, sendPurchaseAlert } from './smsService';
import { listPurchases, getPurchase } from './purchaseService';

export async function runDueDateSweep(supabase) {
  const intervalsStr = await getSetting(supabase, 'alert_intervals') || '7,3,1';
  const intervals = intervalsStr
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => n > 0);

  // Fetch pending cheques
  const cheques = await listCheques(supabase);
  const pendingCheques = cheques.filter(c => ['issued', 'pending', 'partially_paid'].includes(c.status));

  const todayStr = new Date().toISOString().substring(0, 10);

  // 1. Due date intervals sweep
  for (const days of intervals) {
    const category = `due_${days}`;
    
    // Find target date (due exactly YYYY-MM-DD)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    const targetDateStr = targetDate.toISOString().substring(0, 10);

    const dueCheques = pendingCheques.filter(c => c.due_date === targetDateStr);

    for (const cheque of dueCheques) {
      // Check if guard row exists
      const { data: alreadySent } = await supabase
        .from('alerts_sent')
        .select('cheque_id')
        .eq('cheque_id', cheque.id)
        .eq('category', category)
        .maybeSingle();

      if (alreadySent) continue;

      const fullCheque = await getCheque(supabase, cheque.id);
      const result = await sendChequeAlert(supabase, category, fullCheque);
      
      if (result.status !== 'failed') {
        await supabase
          .from('alerts_sent')
          .insert({ cheque_id: cheque.id, category });
      }
    }
  }

  // 2. Overdue warnings sweep
  const overdueAlertsEnabled = await getSetting(supabase, 'overdue_alerts') || 'true';
  if (overdueAlertsEnabled === 'true' || overdueAlertsEnabled === '1') {
    const overdueCheques = pendingCheques.filter(c => c.due_date < todayStr);

    for (const cheque of overdueCheques) {
      const category = `overdue`;
      const uniqueCategory = `${category}:${todayStr}`;

      const { data: alreadySent } = await supabase
        .from('alerts_sent')
        .select('cheque_id')
        .eq('cheque_id', cheque.id)
        .eq('category', uniqueCategory)
        .maybeSingle();

      if (alreadySent) continue;

      const fullCheque = await getCheque(supabase, cheque.id);
      const result = await sendChequeAlert(supabase, category, fullCheque);

      if (result.status !== 'failed') {
        await supabase
          .from('alerts_sent')
          .insert({ cheque_id: cheque.id, category: uniqueCategory });
      }
    }
  }

  // 3. Purchase credit due-date sweep
  await runPurchaseDueSweep(supabase);
}

// Send SMS reminders for supplier credit purchases that still have an
// outstanding balance and are approaching (or past) their due date.
export async function runPurchaseDueSweep(supabase) {
  const daysStr = await getSetting(supabase, 'purchase_alert_days') || '2';
  const intervals = daysStr
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => n >= 0);

  const pending = await listPurchases(supabase, { pendingOnly: true });
  const todayStr = new Date().toISOString().substring(0, 10);

  // Reminders N days before the due date.
  for (const days of intervals) {
    const category = `purchase_due_${days}`;

    const target = new Date();
    target.setDate(target.getDate() + days);
    const targetStr = target.toISOString().substring(0, 10);

    const due = pending.filter(p => p.due_date === targetStr);
    for (const p of due) {
      const { data: alreadySent } = await supabase
        .from('purchase_alerts_sent')
        .select('purchase_id')
        .eq('purchase_id', p.id)
        .eq('category', category)
        .maybeSingle();
      if (alreadySent) continue;

      const full = await getPurchase(supabase, p.id);
      const result = await sendPurchaseAlert(supabase, 'purchase_due', full);
      if (result.status !== 'failed') {
        await supabase.from('purchase_alerts_sent').insert({ purchase_id: p.id, category });
      }
    }
  }

  // Daily overdue warnings (shares the overdue_alerts toggle with cheques).
  const overdueEnabled = await getSetting(supabase, 'overdue_alerts') || 'true';
  if (overdueEnabled === 'true' || overdueEnabled === '1') {
    const overdue = pending.filter(p => p.due_date && p.due_date < todayStr);
    for (const p of overdue) {
      const category = `purchase_overdue:${todayStr}`;
      const { data: alreadySent } = await supabase
        .from('purchase_alerts_sent')
        .select('purchase_id')
        .eq('purchase_id', p.id)
        .eq('category', category)
        .maybeSingle();
      if (alreadySent) continue;

      const full = await getPurchase(supabase, p.id);
      const result = await sendPurchaseAlert(supabase, 'purchase_overdue', full);
      if (result.status !== 'failed') {
        await supabase.from('purchase_alerts_sent').insert({ purchase_id: p.id, category });
      }
    }
  }
}
