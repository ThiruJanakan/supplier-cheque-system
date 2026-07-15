"use client";
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Field } from '@/components/ui';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [pw, setPw] = useState({ current_password: '', new_password: '' });
  const [backups, setBackups] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => Promise.all([api.get('/system/settings'), api.get('/system/backups')])
    .then(([s, b]) => { setSettings(s); setBackups(b); }).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  const saveSettings = async () => {
    setError(''); setNotice('');
    try { await api.put('/system/settings', settings); setNotice('Settings saved.'); }
    catch (e) { setError(e.message); }
  };
  const changePassword = async () => {
    setError(''); setNotice('');
    try { await api.post('/auth/change-password', pw); setNotice('Password changed.'); setPw({ current_password: '', new_password: '' }); }
    catch (e) { setError(e.message); }
  };
  const backupNow = async () => {
    try { await api.post('/system/backups'); setNotice('Manual backup triggered (Automated backups run nightly on Supabase).'); load(); }
    catch (e) { setError(e.message); }
  };

  if (!settings) return <div className="empty">Loading…</div>;

  return (
    <>
      <div className="page-head"><div><h1>Settings</h1><div className="sub">Alerts, account and backups</div></div></div>
      {error && <div className="alert-error">{error}</div>}
      {notice && <div className="alert-ok">{notice}</div>}

      <div className="grid cols-2">
        <div className="card card-pad">
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>SMS alerts</h2>
          <Field label="Admin phone number (receives all alerts)">
            <input value={settings.admin_phone || ''} onChange={e => setSettings({ ...settings, admin_phone: e.target.value })} />
          </Field>
          <Field label="Reminder intervals (days before due date, comma-separated)">
            <input value={settings.alert_intervals || ''} onChange={e => setSettings({ ...settings, alert_intervals: e.target.value })} placeholder="7,3,1" />
          </Field>
          <Field label="Overdue warnings">
            <select value={settings.overdue_alerts} onChange={e => setSettings({ ...settings, overdue_alerts: e.target.value })}>
              <option value="true">Send daily warning for overdue cheques</option>
              <option value="false">Off</option>
            </select>
          </Field>
          <Field label="Currency label">
            <input value={settings.currency || ''} onChange={e => setSettings({ ...settings, currency: e.target.value })} />
          </Field>
          <button className="btn primary" onClick={saveSettings}>Save settings</button>
        </div>

        <div>
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>Change admin password</h2>
            <Field label="Current password"><input type="password" value={pw.current_password} onChange={e => setPw({ ...pw, current_password: e.target.value })} /></Field>
            <Field label="New password (min 8 characters)"><input type="password" value={pw.new_password} onChange={e => setPw({ ...pw, new_password: e.target.value })} /></Field>
            <button className="btn primary" onClick={changePassword}>Change password</button>
          </div>

          <div className="card card-pad">
            <h2 style={{ fontSize: 16, marginBottom: 6 }}>Database backups</h2>
            <p className="muted" style={{ marginTop: 0 }}>Backups run automatically every night. Managed securely by Supabase.</p>
            <button className="btn ghost" onClick={backupNow}>Back up now</button>
            {backups.length > 0 && (
              <table style={{ marginTop: 12 }}>
                <thead><tr><th>File</th><th className="num">Size</th></tr></thead>
                <tbody>
                  {backups.map(b => <tr key={b.file}><td className="mono" style={{ fontSize: 12 }}>{b.file}</td><td className="num">{(b.size / 1024).toFixed(0)} KB</td></tr>)}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
