import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Modal from '../components/Modal';
import { Money, Field } from '../components/ui';

const today = () => new Date().toISOString().slice(0, 10);
const blank = { supplier_id: '', invoice_no: '', description: '', total_amount: '', purchase_date: today() };

export default function Purchases() {
  const [rows, setRows] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [filters, setFilters] = useState({ search: '', supplier_id: '' });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/purchases', { search: filters.search, supplier_id: filters.supplier_id }).then(setRows).catch(e => setError(e.message));
  useEffect(() => { load(); }, [filters]);
  useEffect(() => { api.get('/suppliers').then(setSuppliers); }, []);

  const save = async () => {
    setError('');
    try {
      if (editing.id) await api.put(`/purchases/${editing.id}`, editing);
      else await api.post('/purchases', editing);
      setEditing(null); load();
    } catch (e) { setError(e.message); }
  };
  const remove = async p => {
    if (!confirm(`Delete purchase ${p.invoice_no || '#' + p.id}?`)) return;
    try { await api.del(`/purchases/${p.id}`); load(); } catch (e) { setError(e.message); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Purchases</h1><div className="sub">Supplier purchase transactions</div></div>
        <button className="btn primary" onClick={() => setEditing({ ...blank })}>Record purchase</button>
      </div>
      {error && <div className="alert-error">{error}</div>}
      <div className="toolbar">
        <input placeholder="Search invoice, description, supplier…" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
        <select value={filters.supplier_id} onChange={e => setFilters({ ...filters, supplier_id: e.target.value })}>
          <option value="">All suppliers</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Invoice</th><th>Supplier</th><th>Description</th><th className="num">Total</th><th className="num">Paid</th><th className="num">Outstanding</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="empty">No purchases recorded. Record a purchase to allocate cheques against it.</td></tr>}
            {rows.map(p => {
              const outstanding = p.total_amount - p.paid_amount;
              return (
                <tr key={p.id}>
                  <td className="mono">{p.purchase_date}</td>
                  <td className="mono">{p.invoice_no || `#${p.id}`}</td>
                  <td>{p.supplier_name}</td>
                  <td className="muted">{p.description || '—'}</td>
                  <td className="num"><Money value={p.total_amount} /></td>
                  <td className="num"><Money value={p.paid_amount} /></td>
                  <td className="num" style={{ color: outstanding > 0.005 ? 'var(--amber)' : 'var(--banker)', fontWeight: 600 }}>
                    <Money value={outstanding} />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" onClick={() => setEditing({ ...p })}>Edit</button>{' '}
                    <button className="btn danger sm" onClick={() => remove(p)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.id ? 'Edit purchase' : 'Record purchase'} onClose={() => setEditing(null)}
          footer={<><button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
                   <button className="btn primary" onClick={save}>Save purchase</button></>}>
          <Field label="Supplier *">
            <select value={editing.supplier_id} onChange={e => setEditing({ ...editing, supplier_id: +e.target.value })}>
              <option value="">Select a supplier…</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <div className="grid cols-2">
            <Field label="Invoice number"><input value={editing.invoice_no || ''} onChange={e => setEditing({ ...editing, invoice_no: e.target.value })} /></Field>
            <Field label="Purchase date *"><input type="date" value={editing.purchase_date} onChange={e => setEditing({ ...editing, purchase_date: e.target.value })} /></Field>
          </div>
          <Field label="Total amount *"><input type="number" min="0" step="0.01" value={editing.total_amount} onChange={e => setEditing({ ...editing, total_amount: e.target.value })} /></Field>
          <Field label="Description"><textarea rows={2} value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} /></Field>
        </Modal>
      )}
    </>
  );
}
