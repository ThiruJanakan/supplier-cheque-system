"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/api/client';
import Modal from '@/components/Modal';
import { Money, Field, MoneyInput, CreditChip } from '@/components/ui';

const today = () => new Date().toISOString().slice(0, 10);
const blank = { supplier_id: '', invoice_no: '', description: '', total_amount: '', purchase_date: today(), credit_period_days: '' };
const PRESETS = [30, 45, 60, 70];

const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(n));
  return d.toISOString().slice(0, 10);
};

export default function Purchases() {
  const router = useRouter();
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

  // Credit-period select handling for the modal
  const periodValue = editing && (editing.credit_period_days === '' || editing.credit_period_days == null)
    ? ''
    : (PRESETS.includes(Number(editing.credit_period_days)) ? String(Number(editing.credit_period_days)) : 'other');

  const onPeriodChange = v => {
    if (v === '') setEditing({ ...editing, credit_period_days: '' });
    else if (v === 'other') setEditing({ ...editing, credit_period_days: editing.credit_period_days && !PRESETS.includes(Number(editing.credit_period_days)) ? editing.credit_period_days : 0 });
    else setEditing({ ...editing, credit_period_days: Number(v) });
  };

  const duePreview = editing && editing.purchase_date && editing.credit_period_days !== '' && editing.credit_period_days != null && !isNaN(Number(editing.credit_period_days))
    ? addDays(editing.purchase_date, editing.credit_period_days)
    : null;

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
      <div className="card table-wrap responsive-table">
        <table>
          <thead><tr><th>Date</th><th>Invoice</th><th>Supplier</th><th>Due date</th><th className="num">Total</th><th className="num">Paid</th><th className="num">Outstanding</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="empty">No purchases recorded. Record a purchase to allocate cheques against it.</td></tr>}
            {rows.map(p => (
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/purchases/${p.id}`)}>
                <td className="mono" data-label="Date">{p.purchase_date}</td>
                <td className="mono" data-label="Invoice">{p.invoice_no || `#${p.id}`}</td>
                <td data-label="Supplier">{p.supplier_name}</td>
                <td data-label="Due date">
                  {p.due_date ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                      <span className="mono">{p.due_date}</span>
                      {p.outstanding > 0.005 && <CreditChip status={p.status} days={p.days_to_due} />}
                    </div>
                  ) : <span className="muted">—</span>}
                </td>
                <td className="num" data-label="Total"><Money value={p.total_amount} /></td>
                <td className="num" data-label="Paid"><Money value={p.paid_amount} /></td>
                <td className="num" data-label="Outstanding" style={{ color: p.outstanding > 0.005 ? 'var(--amber)' : 'var(--banker)', fontWeight: 600 }}>
                  <Money value={p.outstanding} />
                </td>
                <td style={{ whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                  <button className="btn ghost sm" onClick={() => router.push(`/purchases/${p.id}`)}>View</button>{' '}
                  <button className="btn ghost sm" onClick={() => setEditing({ ...p })}>Edit</button>{' '}
                  <button className="btn danger sm" onClick={() => remove(p)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.id ? 'Edit purchase' : 'Record purchase'} onClose={() => setEditing(null)}
          footer={<><button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
                   <button className="btn primary" onClick={save}>Save purchase</button></>}>
          <Field label="Supplier *">
            <select value={editing.supplier_id} onChange={e => setEditing({ ...editing, supplier_id: e.target.value ? Number(e.target.value) : '' })}>
              <option value="">Select a supplier…</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <div className="grid cols-2">
            <Field label="Invoice number"><input value={editing.invoice_no || ''} onChange={e => setEditing({ ...editing, invoice_no: e.target.value })} /></Field>
            <Field label="Purchase date *"><input type="date" value={editing.purchase_date} onChange={e => setEditing({ ...editing, purchase_date: e.target.value })} /></Field>
          </div>
          <Field label="Total amount *"><MoneyInput value={editing.total_amount} onChange={v => setEditing({ ...editing, total_amount: v })} placeholder="0.00" /></Field>
          <div className="grid cols-2">
            <Field label="Credit payment period">
              <select value={periodValue} onChange={e => onPeriodChange(e.target.value)}>
                <option value="">No credit (paid now)</option>
                <option value="30">30 days</option>
                <option value="45">45 days</option>
                <option value="60">60 days</option>
                <option value="70">70 days</option>
                <option value="other">Other…</option>
              </select>
            </Field>
            {periodValue === 'other' && (
              <Field label="Custom period (days)">
                <input type="number" min="0" step="1" value={editing.credit_period_days} onChange={e => setEditing({ ...editing, credit_period_days: e.target.value === '' ? '' : Number(e.target.value) })} />
              </Field>
            )}
          </div>
          {duePreview && (
            <div className="muted" style={{ fontSize: 12.5, marginTop: -4, marginBottom: 6 }}>
              Payment due on <strong>{duePreview}</strong> ({editing.credit_period_days} days after purchase).
            </div>
          )}
          <Field label="Description"><textarea rows={2} value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} /></Field>
        </Modal>
      )}
    </>
  );
}
