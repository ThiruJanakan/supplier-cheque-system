export async function send({ to, message }) {
  const provider = process.env.SMS_PROVIDER || 'console';
  const apiUrl = process.env.SMS_API_URL || '';
  const apiKey = process.env.SMS_API_KEY || '';
  const senderId = process.env.SMS_SENDER_ID || 'CHQ-ALERT';

  // Format to standard international number format (e.g. "94770000000" instead of "+94770000000")
  let formattedTo = to.trim();
  if (formattedTo.startsWith('+')) {
    formattedTo = formattedTo.substring(1);
  }

  if (provider === 'textlk') {
    const url = apiUrl || 'https://app.text.lk/api/v3/sms/send';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        recipient: formattedTo,
        sender_id: senderId,
        type: 'plain',
        message
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Text.lk SMS gateway responded ${res.status}: ${text}`);
    }

    const body = await res.json().catch(() => ({}));
    if (body.status === 'success' || (body.data && body.data.uid)) {
      const providerRef = (body.data && body.data.uid) || body.uid || `textlk-${Date.now()}`;
      return { providerRef, delivered: true };
    }
    throw new Error(body.message || 'Failed to send SMS via Text.lk');
  }

  if (provider === 'http' && apiUrl) {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${apiKey}` 
      },
      body: JSON.stringify({ to: formattedTo, from: senderId, message }),
    });
    if (!res.ok) {
      throw new Error(`SMS gateway responded ${res.status}: ${await res.text()}`);
    }
    const body = await res.json().catch(() => ({}));
    return { providerRef: body.id || body.message_id || null, delivered: true };
  }

  // console provider (default)
  console.log(`\n[SMS -> ${formattedTo}] ${message}\n`);
  return { providerRef: `console-${Date.now()}`, delivered: true };
}
