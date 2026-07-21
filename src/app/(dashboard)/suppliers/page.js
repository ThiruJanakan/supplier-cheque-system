"use client";
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import Modal from '@/components/Modal';
import { Money, Field } from '@/components/ui';
import { useUI } from '@/context/UIContext';

const blank = { name: '', contact_person: '', phone: '', email: '', address: '', bank_name: '', bank_account_no: '', branch_name: '', branch_code: '', notes: '' };

export default function Suppliers() {
  const { toast, confirm } = useUI();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('');         // '' = all time, else YYYY-MM
  const [editing, setEditing] = useState(null);   // null | {id?, ...fields}

  const load = () => api.get('/suppliers', { search, month }).then(setRows).catch(e => toast.error(e.message));
  useEffect(() => { load(); }, [search, month]);

  const save = async () => {
    if (!editing.name || !editing.name.trim()) {
      toast.error('Supplier name is required.');
      return;
    }
    if (editing.phone) {
      const cleanPhone = editing.phone.trim();
      if (cleanPhone && !/^\+?[0-9\s\-()]{7,20}$/.test(cleanPhone)) {
        toast.error('Phone number must be a valid format (7-20 digits).');
        return;
      }
    }
    if (editing.email) {
      const cleanEmail = editing.email.trim();
      if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        toast.error('Email address must be a valid format.');
        return;
      }
    }
    if (editing.bank_account_no) {
      const cleanBankNo = editing.bank_account_no.trim();
      if (cleanBankNo && !/^\d+$/.test(cleanBankNo)) {
        toast.error('Bank account number must contain only numbers.');
        return;
      }
    }

    try {
      if (editing.id) await api.put(`/suppliers/${editing.id}`, editing);
      else await api.post('/suppliers', editing);
      setEditing(null); toast.success('Supplier saved.'); load();
    } catch (e) { toast.error(e.message); }
  };

  const downloadPdf = async () => {
    try { await api.download('/suppliers/export/pdf', { month }, `suppliers_${month || new Date().toISOString().slice(0, 10)}.pdf`); }
    catch (e) { toast.error(e.message); }
  };

  const remove = async s => {
    const confirmed = await confirm({
      title: 'Delete Supplier',
      message: `Delete "${s.name}"? Suppliers with purchase or cheque history are archived instead of removed.`,
      danger: true,
      confirmText: 'Delete'
    });
    if (!confirmed) return;
    try {
      const r = await api.del(`/suppliers/${s.id}`);
      toast.success(r.deactivated ? 'Supplier archived (has transaction history).' : 'Supplier deleted.');
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Suppliers</h1><div className="sub">{rows.length} active suppliers{month ? ` · totals for ${month}` : ''}</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost" onClick={downloadPdf}>Download PDF</button>
          <button className="btn primary" onClick={() => setEditing({ ...blank })}>Add supplier</button>
        </div>
      </div>
      <div className="toolbar">
        <input placeholder="Search name, contact or phone…" value={search} onChange={e => setSearch(e.target.value)} />
        <input type="month" title="Show purchase & cheque totals for a month" value={month} onChange={e => setMonth(e.target.value)} />
        {month && <button className="btn ghost sm" onClick={() => setMonth('')}>All time</button>}
      </div>
      <div className="card table-wrap responsive-table">
        <table>
          <thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th>Bank account details</th><th className="num">Purchases</th><th className="num">Cheques issued</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="empty">No suppliers yet. Add your first supplier to start recording purchases.</td></tr>}
            {rows.map(s => (
              <tr key={s.id}>
                <td data-label="Name"><strong>{s.name}</strong></td>
                <td data-label="Contact">{s.contact_person || <span className="muted">—</span>}</td>
                <td className="mono" data-label="Phone">{s.phone || '—'}</td>
                <td data-label="Bank details">
                  {s.bank_name ? (
                    <div>
                      <div><strong>{s.bank_name}</strong></div>
                      <div className="muted mono" style={{ fontSize: 11 }}>
                        Acc: {s.bank_account_no || '—'} {s.branch_name ? `· ${s.branch_name}` : ''} {s.branch_code ? `(${s.branch_code})` : ''}
                      </div>
                    </div>
                  ) : <span className="muted">—</span>}
                </td>
                <td className="num" data-label="Purchases"><Money value={s.total_purchases} /></td>
                <td className="num" data-label="Cheques"><Money value={s.total_cheques} /></td>
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
            <Field label="Address"><input value={editing.address || ''} onChange={e => setEditing({ ...editing, address: e.target.value })} /></Field>
          </div>
          
          <h3 style={{ fontSize: 14, margin: '14px 0 8px', borderBottom: '1px solid var(--rule)', paddingBottom: '4px' }}>Bank Account details</h3>
          <div className="grid cols-2">
            <Field label="Bank name"><input value={editing.bank_name || ''} onChange={e => setEditing({ ...editing, bank_name: e.target.value })} /></Field>
            <Field label="Bank account number"><input value={editing.bank_account_no || ''} onChange={e => setEditing({ ...editing, bank_account_no: e.target.value })} /></Field>
            <Field label="Branch name"><input value={editing.branch_name || ''} onChange={e => setEditing({ ...editing, branch_name: e.target.value })} /></Field>
            <Field label="Branch number / code"><input value={editing.branch_code || ''} onChange={e => setEditing({ ...editing, branch_code: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><textarea rows={2} value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></Field>
        </Modal>
      )}
    </>
  );
}
