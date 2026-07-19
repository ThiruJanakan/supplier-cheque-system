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

// Resolve the base URL used to build SMS deep links. Prefer the Settings value,
// fall back to the deployment env, then empty string.
async function appBaseUrl(supabase) {
  const fromSettings = await getSetting(supabase, 'app_base_url');
  const base = (fromSettings || process.env.NEXT_PUBLIC_APP_URL || '').trim();
  return base.replace(/\/+$/, ''); // strip trailing slash
}

// Purchase due/overdue reminder addressed to the admin. Includes the supplier,
// purchase detail, outstanding due amount, due date and a deep link.
export async function sendPurchaseAlert(supabase, category, purchase) {
  const recipient = await getSetting(supabase, 'admin_phone');
  if (!recipient) {
    console.error('No admin_phone configured in settings.');
    return { error: 'No admin phone configured' };
  }

  const amountStr = await fmtAmount(supabase, purchase.outstanding);
  const invoice = purchase.invoice_no ? `Invoice ${purchase.invoice_no}` : `Purchase #${purchase.id}`;
  const desc = purchase.description ? ` (${purchase.description})` : '';
  const base = await appBaseUrl(supabase);
  const link = base ? ` View: ${base}/purchases/${purchase.id}` : '';

  const head = category === 'purchase_overdue'
    ? 'OVERDUE: Supplier credit payment is past due.'
    : 'REMINDER: Supplier credit payment due soon.';

  const message =
    `${head} Supplier: ${purchase.supplier_name} | ${invoice}${desc} | ` +
    `Due amount: ${amountStr} | Due date: ${purchase.due_date}.${link}`;

  return sendRaw(supabase, { recipient, message, category, purchaseId: purchase.id });
}

export async function sendRaw(supabase, { recipient, message, category = 'test', chequeId = null, purchaseId = null }) {
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
      purchase_id: purchaseId,
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
