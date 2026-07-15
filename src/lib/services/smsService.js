import * as gateway from '../smsGateway';
import { getSetting } from './settingsService';

async function fmtAmount(supabase, n) {
  const currency = await getSetting(supabase, 'currency') || 'LKR';
  return `${currency} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

async function chequeLine(supabase, cheque) {
  const amountStr = await fmtAmount(supabase, cheque.amount);
  return `Supplier: ${cheque.supplier_name} | Cheque No: ${cheque.cheque_number} | Amount: ${amountStr} | Due: ${cheque.due_date}`;
}

const TEMPLATES = {
  due_7:   async (supabase, c) => `REMINDER (7 days): Cheque due soon. ${await chequeLine(supabase, c)}`,
  due_3:   async (supabase, c) => `REMINDER (3 days): Cheque due soon. ${await chequeLine(supabase, c)}`,
  due_1:   async (supabase, c) => `URGENT (1 day): Cheque due TOMORROW. ${await chequeLine(supabase, c)}. Ensure funds are available.`,
  overdue: async (supabase, c) => `OVERDUE: Cheque has passed its due date and is not cleared. ${await chequeLine(supabase, c)}`,
  cleared: async (supabase, c) => `CLEARED: Cheque payment confirmed. ${await chequeLine(supabase, c)}`,
  bounced: async (supabase, c) => `BOUNCED: Cheque was returned by the bank. ${await chequeLine(supabase, c)}. Immediate action required.`,
};

export async function sendChequeAlert(supabase, category, cheque) {
  const recipient = await getSetting(supabase, 'admin_phone');
  if (!recipient) {
    console.error('No admin_phone configured in settings.');
    return { error: 'No admin phone configured' };
  }
  const message = await TEMPLATES[category](supabase, cheque);
  return sendRaw(supabase, { recipient, message, category, chequeId: cheque.id });
}

export async function sendRaw(supabase, { recipient, message, category = 'test', chequeId = null }) {
  let status = 'sent', providerRef = null, error = null;
  try {
    const result = await gateway.send({ to: recipient, message });
    providerRef = result.providerRef;
    if (result.delivered) status = 'delivered';
  } catch (e) {
    status = 'failed';
    error = e.message;
  }

  const { data, error: errInsert } = await supabase
    .from('sms_logs')
    .insert({
      recipient,
      message,
      category,
      cheque_id: chequeId,
      status,
      provider_ref: providerRef,
      error
    })
    .select('id')
    .single();

  if (errInsert) {
    console.error('Error logging SMS to database:', errInsert);
  }

  return { id: data ? data.id : null, status, providerRef, error };
}
