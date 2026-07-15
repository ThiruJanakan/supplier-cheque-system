"use client";
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import Modal from '@/components/Modal';
import { Money, Field } from '@/components/ui';

const blank = { name: '', contact_person: '', phone: '', email: '', address: '', bank_name: '', notes: '' };

export default function Suppliers() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);   // null | {id?, ...fields}
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => api.get('/suppliers', { search }).then(setRows).catch(e => setError(e.message));
  useEffect(() => { load(); }, [search]);

  const save = async () => {
    setError('');
    try {
      if (editing.id) await api.put(`/suppliers/${editing.id}`, editing);
      else await api.post('/suppliers', editing);
      setEditing(null); setNotice('Supplier saved.'); load();
    } catch (e) { setError(e.message); }
  };

  const remove = async s => {
    if (!confirm(`Delete "${s.name}"? Suppliers with purchase or cheque history are archived instead of removed.`)) return;
    try {
      const r = await api.del(`/suppliers/${s.id}`);
      setNotice(r.deactivated ? 'Supplier archived (has transaction history).' : 'Supplier deleted.');
      load();
    } catch (e) { setError(e.message); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Suppliers</h1><div className="sub">{rows.length} active suppliers</div></div>
        <button className="btn primary" onClick={() => setEditing({ ...blank })}>Add supplier</button>
      </div>
      {error && <div className="alert-error">{error}</div>}
      {notice && <div className="alert-ok">{notice}</div>}
      <div className="toolbar">
        <input placeholder="Search name, contact or phone…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th>Bank</th><th className="num">Purchases</th><th className="num">Cheques issued</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="empty">No suppliers yet. Add your first supplier to start recording purchases.</td></tr>}
            {rows.map(s => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong></td>
                <td>{s.contact_person || <span className="muted">—</span>}</td>
                <td className="mono">{s.phone || '—'}</td>
                <td>{s.bank_name || <span className="muted">—</span>}</td>
                <td className="num"><Money value={s.total_purchases} /></td>
                <td className="num"><Money value={s.total_cheques} /></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn ghost sm" onClick={() => setEditing({ ...blank, ...s })}>Edit</button>{' '}
                  <button className="btn danger sm" onClick={() => remove(s)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.id ? `Edit ${editing.name}` : 'Add supplier'} onClose={() => setEditing(null)}
          footer={<><button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
                   <button className="btn primary" onClick={save}>Save supplier</button></>}>
          <Field label="Supplier name *"><input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
          <div className="grid cols-2">
            <Field label="Contact person"><input value={editing.contact_person || ''} onChange={e => setEditing({ ...editing, contact_person: e.target.value })} /></Field>
            <Field label="Phone"><input value={editing.phone || ''} onChange={e => setEditing({ ...editing, phone: e.target.value })} /></Field>
            <Field label="Email"><input value={editing.email || ''} onChange={e => setEditing({ ...editing, email: e.target.value })} /></Field>
            <Field label="Bank"><input value={editing.bank_name || ''} onChange={e => setEditing({ ...editing, bank_name: e.target.value })} /></Field>
          </div>
          <Field label="Address"><input value={editing.address || ''} onChange={e => setEditing({ ...editing, address: e.target.value })} /></Field>
          <Field label="Notes"><textarea rows={2} value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></Field>
        </Modal>
      )}
    </>
  );
}
