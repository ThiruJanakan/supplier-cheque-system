import { listCheques, getCheque } from './chequeService';
import { getSetting } from './settingsService';
import { sendChequeAlert } from './smsService';

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
}
