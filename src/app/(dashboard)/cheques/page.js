"use client";
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import Modal from '@/components/Modal';
import { Money, Stamp, ChequeNo, Field } from '@/components/ui';

const today = () => new Date().toISOString().slice(0, 10);
const blank = { cheque_number: '', supplier_id: '', amount: '', issue_date: today(), due_date: '', bank_name: '', bank_account_no: '', branch_name: '', branch_code: '', notes: '', allocations: [] };
const STATUSES = ['issued', 'pending', 'partially_paid', 'cleared', 'bounced', 'cancelled'];
const NEXT = {
  issued: ['pending', 'partially_paid', 'cleared', 'bounced', 'cancelled'],
  pending: ['partially_paid', 'cleared', 'bounced', 'cancelled'],
  partially_paid: ['pending', 'cleared', 'bounced', 'cancelled'],
  cleared: [], bounced: ['pending'], cancelled: [],
};

export default function Cheques() {
  const [rows, setRows] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);   // open purchases for the selected supplier
  const [filters, setFilters] = useState({ search: '', status: '', supplier_id: '' });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => api.get('/cheques', filters).then(setRows).catch(e => setError(e.message));
  useEffect(() => { load(); }, [filters]);
  useEffect(() => { api.get('/suppliers').then(setSuppliers); }, []);

  // When the supplier changes inside the editor, load that supplier's purchases
  useEffect(() => {
    if (editing?.supplier_id) {
      api.get('/purchases', { supplier_id: editing.supplier_id }).then(setPurchases);
    } else setPurchases([]);
  }, [editing?.supplier_id]);

  const openEdit = async c => {
    const full = await api.get(`/cheques/${c.id}`);
    setEditing({ ...full, allocations: full.allocations.map(a => ({ purchase_id: a.purchase_id, allocated_amount: a.allocated_amount })) });
  };

  const save = async () => {
    setError('');
    const payload = { ...editing, allocations: editing.allocations.filter(a => a.purchase_id && a.allocated_amount) };
    try {
      if (editing.id) await api.put(`/cheques/${editing.id}`, payload);
      else await api.post('/cheques', payload);
      setEditing(null); setNotice('Cheque saved.'); load();
    } catch (e) { setError(e.message); }
  };

  const setStatus = async (c, status) => {
    if (!status) return;
    const warnings = {
      cleared: `Mark cheque ${c.cheque_number} as CLEARED? The amount will be drawn from the savings account and a confirmation SMS will be sent.`,
      bounced: `Mark cheque ${c.cheque_number} as BOUNCED? A bounce alert SMS will be sent.`,
      cancelled: `Cancel cheque ${c.cheque_number}? This is final.`,
    };
    if (warnings[status] && !confirm(warnings[status])) return;
    setError('');
    try { await api.post(`/cheques/${c.id}/status`, { status }); setNotice(`Cheque ${c.cheque_number} marked ${status.replace('_', ' ')}.`); load(); }
    catch (e) { setError(e.message); }
  };

  const remove = async c => {
    if (!confirm(`Delete cheque ${c.cheque_number}? Only issued/cancelled cheques can be removed.`)) return;
    try { await api.del(`/cheques/${c.id}`); load(); } catch (e) { setError(e.message); }
  };

  const allocTotal = editing ? editing.allocations.reduce((s, a) => s + (Number(a.allocated_amount) || 0), 0) : 0;

  return (
    <>
      <div className="page-head">
        <div><h1>Cheques</h1><div className="sub">Register, allocate and track every cheque through its lifecycle</div></div>
        <button className="btn primary" onClick={() => setEditing({ ...blank })}>Register cheque</button>
      </div>
      {error && <div className="alert-error">{error}</div>}
      {notice && <div className="alert-ok">{notice}</div>}
      <div className="toolbar">
        <input placeholder="Search cheque no, supplier, bank…" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
        <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={filters.supplier_id} onChange={e => setFilters({ ...filters, supplier_id: e.target.value })}>
          <option value="">All suppliers</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="card table-wrap responsive-table">
        <table>
          <thead><tr><th>Cheque no</th><th>Supplier</th><th className="num">Amount</th><th>Issued</th><th>Due</th><th>Status</th><th>Move to</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="empty">No cheques found. Register a cheque to begin tracking due dates.</td></tr>}
            {rows.map(c => (
              <tr key={c.id}>
                <td data-label="Cheque no"><ChequeNo>{c.cheque_number}</ChequeNo></td>
                <td data-label="Supplier">{c.supplier_name}</td>
                <td className="num" data-label="Amount"><Money value={c.amount} /></td>
                <td className="mono" data-label="Issued">{c.issue_date}</td>
                <td className="mono" data-label="Due">{c.due_date}</td>
                <td data-label="Status"><Stamp status={c.status} /></td>
                <td data-label="Move to">
                  {NEXT[c.status].length > 0 ? (
                    <select defaultValue="" onChange={e => { setStatus(c, e.target.value); e.target.value = ''; }}>
                      <option value="" disabled>Change…</option>
                      {NEXT[c.status].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  ) : <span className="muted">final</span>}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn ghost sm" onClick={() => openEdit(c)}>Edit</button>{' '}
                  {['issued', 'cancelled'].includes(c.status) &&
                    <button className="btn danger sm" onClick={() => remove(c)}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.id ? `Edit cheque ${editing.cheque_number}` : 'Register cheque'} onClose={() => setEditing(null)}
          footer={<><button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
                   <button className="btn primary" onClick={save}>Save cheque</button></>}>
          <div className="grid cols-2">
            <Field label="Cheque number *"><input value={editing.cheque_number} onChange={e => setEditing({ ...editing, cheque_number: e.target.value })} /></Field>
            <Field label="Supplier *">
              <select value={editing.supplier_id} onChange={e => setEditing({ ...editing, supplier_id: e.target.value ? Number(e.target.value) : '', allocations: [] })}>
                <option value="">Select…</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Amount *"><input type="number" min="0" step="0.01" value={editing.amount} onChange={e => setEditing({ ...editing, amount: e.target.value })} /></Field>
            <Field label="Issue date *"><input type="date" value={editing.issue_date} onChange={e => setEditing({ ...editing, issue_date: e.target.value })} /></Field>
            <Field label="Due date *"><input type="date" value={editing.due_date} onChange={e => setEditing({ ...editing, due_date: e.target.value })} /></Field>
          </div>
          
          <h3 style={{ fontSize: 14, margin: '14px 0 8px', borderBottom: '1px solid var(--rule)', paddingBottom: '4px' }}>Drawing Bank details</h3>
          <div className="grid cols-2">
            <Field label="Drawing bank name"><input value={editing.bank_name || ''} onChange={e => setEditing({ ...editing, bank_name: e.target.value })} /></Field>
            <Field label="Bank account number"><input value={editing.bank_account_no || ''} onChange={e => setEditing({ ...editing, bank_account_no: e.target.value })} /></Field>
            <Field label="Branch name"><input value={editing.branch_name || ''} onChange={e => setEditing({ ...editing, branch_name: e.target.value })} /></Field>
            <Field label="Branch number / code"><input value={editing.branch_code || ''} onChange={e => setEditing({ ...editing, branch_code: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><input value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></Field>

          <h3 style={{ fontSize: 14, margin: '14px 0 8px' }}>Allocate to purchases (partial payments)</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>
            Split this cheque across one or more of the supplier's outstanding purchases. Several cheques can settle a single purchase over time.
          </p>
          {editing.allocations.map((a, i) => {
            const p = purchases.find(x => x.id === a.purchase_id);
            const outstanding = p ? p.total_amount - p.paid_amount : null;
            return (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <select style={{ flex: 2 }} value={a.purchase_id || ''} onChange={e => {
                  const next = [...editing.allocations]; next[i] = { ...a, purchase_id: e.target.value ? Number(e.target.value) : '' };
                  setEditing({ ...editing, allocations: next });
                }}>
                  <option value="">Select purchase…</option>
                  {purchases.map(p => (
                    <option key={p.id} value={p.id}>
                      {(p.invoice_no || `#${p.id}`)} · {p.purchase_date} · outstanding {(p.total_amount - p.paid_amount).toFixed(2)}
                    </option>
                  ))}
                </select>
                <input style={{ flex: 1 }} type="number" min="0" step="0.01" placeholder="Amount"
                  value={a.allocated_amount} onChange={e => {
                    const next = [...editing.allocations]; next[i] = { ...a, allocated_amount: e.target.value };
                    setEditing({ ...editing, allocations: next });
                  }} />
                <button className="x" title="Remove allocation" onClick={() => setEditing({ ...editing, allocations: editing.allocations.filter((_, j) => j !== i) })}>×</button>
                {outstanding !== null && <span className="muted mono" style={{ fontSize: 11 }}>max {outstanding.toFixed(2)}</span>}
              </div>
            );
          })}
          <button className="btn ghost sm" disabled={!editing.supplier_id}
            onClick={() => setEditing({ ...editing, allocations: [...editing.allocations, { purchase_id: '', allocated_amount: '' }] })}>
            + Add allocation
          </button>
          {editing.allocations.length > 0 && (
            <div className="mono" style={{ marginTop: 10, fontSize: 12.5, color: allocTotal > +editing.amount ? 'var(--claret)' : 'var(--muted)' }}>
              Allocated {allocTotal.toFixed(2)} of {(Number(editing.amount) || 0).toFixed(2)}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
