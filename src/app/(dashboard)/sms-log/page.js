"use client";
import { useEffect, useState } from 'react';
import { api } from '@/api/client';

const CATS = ['due_7', 'due_3', 'due_1', 'overdue', 'cleared', 'bounced', 'test'];

function formatLocalTime(utcString) {
  if (!utcString) return '—';
  try {
    const d = new Date(utcString);
    if (isNaN(d.getTime())) return utcString;
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${Y}-${M}-${D} ${h}:${m}:${s}`;
  } catch (e) {
    return utcString;
  }
}

export default function SmsLog() {
  const [rows, setRows] = useState([]);
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => api.get('/system/sms-logs', { category }).then(setRows).catch(e => setError(e.message));
  useEffect(() => { load(); }, [category]);

  const runSweep = async () => {
    try { await api.post('/system/run-alert-sweep'); setNotice('Due-date sweep completed. Any new reminders appear below.'); load(); }
    catch (e) { setError(e.message); }
  };
  const testSms = async () => {
    try { const r = await api.post('/system/test-sms'); setNotice(`Test SMS ${r.status || 'sent'}.`); load(); }
    catch (e) { setError(e.message); }
  };

  const badge = s => ({ delivered: 'var(--banker)', sent: 'var(--amber)', failed: 'var(--claret)' }[s]);

  return (
    <>
      <div className="page-head">
        <div><h1>SMS log</h1><div className="sub">Delivery confirmation for every alert sent</div></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn ghost" onClick={testSms}>Send test SMS</button>
          <button className="btn primary" onClick={runSweep}>Run due-date sweep now</button>
        </div>
      </div>
      {error && <div className="alert-error">{error}</div>}
      {notice && <div className="alert-ok">{notice}</div>}
      <div className="toolbar">
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="card table-wrap responsive-table">
        <table>
          <thead><tr><th>Sent at</th><th>Category</th><th>Recipient</th><th>Message</th><th>Status</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="empty">No messages sent yet. Alerts run automatically every morning.</td></tr>}
            {rows.map(l => (
              <tr key={l.id}>
                <td className="mono" data-label="Sent at" style={{ fontSize: 12 }}>{formatLocalTime(l.sent_at)}</td>
                <td className="mono" data-label="Category">{l.category}</td>
                <td className="mono" data-label="Recipient">{l.recipient}</td>
                <td data-label="Message" style={{ maxWidth: 420 }}>{l.message}{l.error && <div className="muted" style={{ color: 'var(--claret)' }}>{l.error}</div>}</td>
                <td data-label="Status"><span className="mono" style={{ color: badge(l.status), fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>{l.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
