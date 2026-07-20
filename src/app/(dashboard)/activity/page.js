"use client";
import { useEffect, useState } from 'react';
import { api } from '@/api/client';

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

export default function ActivityLog() {
  const [rows, setRows] = useState([]);
  const [type, setType] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/system/activity-logs', { entity_type: type }).then(setRows).catch(e => setError(e.message));
  }, [type]);

  return (
    <>
      <div className="page-head">
        <div><h1>Activity log</h1><div className="sub">Every modification made in the system</div></div>
      </div>
      {error && <div className="alert-error">{error}</div>}
      <div className="toolbar">
        <select value={type} onChange={e => setType(e.target.value)}>
          <option value="">All entities</option>
          {['supplier', 'purchase', 'cheque', 'revenue', 'settings', 'auth', 'system', 'user'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="card table-wrap responsive-table">
        <table>
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="empty">No activity recorded yet.</td></tr>}
            {rows.map(a => (
              <tr key={a.id}>
                <td className="mono" data-label="When" style={{ fontSize: 12 }}>{formatLocalTime(a.created_at)}</td>
                <td data-label="User">{a.username || '—'}</td>
                <td className="mono" data-label="Action">{a.action}</td>
                <td data-label="Entity">{a.entity_type}{a.entity_id ? ` #${a.entity_id}` : ''}</td>
                <td className="muted mono" data-label="Details" style={{ fontSize: 12 }}>{a.details || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
