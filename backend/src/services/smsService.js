// Business layer: composes SMS messages, sends them via the gateway adapter,
// and records every attempt in the delivery-confirmation log.
const gateway = require('../utils/smsGateway');
const smsLogRepo = require('../repositories/smsLogRepository');
const settingsRepo = require('../repositories/settingsRepository');

function fmtAmount(n) {
  const currency = settingsRepo.get('currency') || 'LKR';
  return `${currency} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// Required format: Supplier Name, Cheque Number, Cheque Amount, Due Date
function chequeLine(cheque) {
  return `Supplier: ${cheque.supplier_name} | Cheque No: ${cheque.cheque_number} | Amount: ${fmtAmount(cheque.amount)} | Due: ${cheque.due_date}`;
}

const TEMPLATES = {
  due_7:   c => `REMINDER (7 days): Cheque due soon. ${chequeLine(c)}`,
  due_3:   c => `REMINDER (3 days): Cheque due soon. ${chequeLine(c)}`,
  due_1:   c => `URGENT (1 day): Cheque due TOMORROW. ${chequeLine(c)}. Ensure funds are available.`,
  overdue: c => `OVERDUE: Cheque has passed its due date and is not cleared. ${chequeLine(c)}`,
  cleared: c => `CLEARED: Cheque payment confirmed. ${chequeLine(c)}`,
  bounced: c => `BOUNCED: Cheque was returned by the bank. ${chequeLine(c)}. Immediate action required.`,
};

async function sendChequeAlert(category, cheque) {
  const recipient = settingsRepo.get('admin_phone');
  const message = TEMPLATES[category](cheque);
  return sendRaw({ recipient, message, category, chequeId: cheque.id });
}

async function sendRaw({ recipient, message, category = 'test', chequeId = null }) {
  let status = 'sent', providerRef = null, error = null;
  try {
    const result = await gateway.send({ to: recipient, message });
    providerRef = result.providerRef;
    if (result.delivered) status = 'delivered';
  } catch (e) {
    status = 'failed';
    error = e.message;
  }
  const info = smsLogRepo.create({ recipient, message, category, cheque_id: chequeId, status, provider_ref: providerRef, error });
  return { id: info.lastInsertRowid, status, providerRef, error };
}

module.exports = { sendChequeAlert, sendRaw };
