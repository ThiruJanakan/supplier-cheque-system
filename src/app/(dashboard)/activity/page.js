"use client";
import { useEffect, useState } from 'react';
import { api } from '@/api/client';

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
      <div className="card table-wrap">
        <table>
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="empty">No activity recorded yet.</td></tr>}
            {rows.map(a => (
              <tr key={a.id}>
                <td className="mono" style={{ fontSize: 12 }}>{a.created_at}</td>
                <td>{a.username || '—'}</td>
                <td className="mono">{a.action}</td>
                <td>{a.entity_type}{a.entity_id ? ` #${a.entity_id}` : ''}</td>
                <td className="muted mono" style={{ fontSize: 12 }}>{a.details || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
