export async function send({ to, message }) {
  const provider = process.env.SMS_PROVIDER || 'console';
  const apiUrl = process.env.SMS_API_URL || '';
  const apiKey = process.env.SMS_API_KEY || '';
  const senderId = process.env.SMS_SENDER_ID || 'CHQ-ALERT';

  if (provider === 'http' && apiUrl) {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${apiKey}` 
      },
      body: JSON.stringify({ to, from: senderId, message }),
    });
    if (!res.ok) {
      throw new Error(`SMS gateway responded ${res.status}: ${await res.text()}`);
    }
    const body = await res.json().catch(() => ({}));
    return { providerRef: body.id || body.message_id || null, delivered: true };
  }

  // console provider (default)
  console.log(`\n[SMS -> ${to}] ${message}\n`);
  return { providerRef: `console-${Date.now()}`, delivered: true };
}
