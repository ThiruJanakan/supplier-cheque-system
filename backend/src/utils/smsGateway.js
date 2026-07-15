// SMS gateway adapter. Two providers:
//   console : prints the SMS to the server log (development / no gateway yet)
//   http    : POSTs to a generic REST SMS gateway (Twilio-style / local providers
//             such as Dialog Ideamart, Notify.lk, Textware - adjust payload as needed)
// The rest of the system only ever calls send(); swapping provider is config-only.
const env = require('../config/env');

async function send({ to, message }) {
  if (env.sms.provider === 'http' && env.sms.apiUrl) {
    const res = await fetch(env.sms.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.sms.apiKey}` },
      body: JSON.stringify({ to, from: env.sms.senderId, message }),
    });
    if (!res.ok) throw new Error(`SMS gateway responded ${res.status}: ${await res.text()}`);
    const body = await res.json().catch(() => ({}));
    return { providerRef: body.id || body.message_id || null, delivered: true };
  }
  // console provider (default)
  console.log(`\n[SMS -> ${to}] ${message}\n`);
  return { providerRef: `console-${Date.now()}`, delivered: true };
}

module.exports = { send };
