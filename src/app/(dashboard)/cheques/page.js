"use client";
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import Modal from '@/components/Modal';
import { Money, Stamp, ChequeNo, Field } from '@/components/ui';
import { useUI } from '@/context/UIContext';

const today = () => new Date().toISOString().slice(0, 10);
const blank = { cheque_number: '', supplier_id: '', amount: '', issue_date: today(), due_date: '', bank_name: '', bank_account_no: '', branch_name: '', branch_code: '', notes: '', allocations: [] };
const STATUSES = ['issued', 'pending', 'partially_paid', 'cleared', 'bounced', 'cancelled'];
const NEXT = {
  issued: ['pending', 'partially_paid', 'cleared', 'bounced', 'cancelled'],
  pending: ['issued', 'partially_paid', 'cleared', 'bounced', 'cancelled'],
  partially_paid: ['issued', 'pending', 'cleared', 'bounced', 'cancelled'],
  cleared: [], bounced: ['pending'], cancelled: [],
};

export default function Cheques() {
  const { toast, confirm } = useUI();
  const [rows, setRows] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);   // open purchases for the selected supplier
  const [filters, setFilters] = useState({ search: '', status: '', supplier_id: '', month: '', month_by: 'due' });
  const [editing, setEditing] = useState(null);
  const [initialAllocations, setInitialAllocations] = useState([]);

  // First and last day of a YYYY-MM month, for the API's date-range params.
  const monthRange = m => {
    const [y, mo] = m.split('-').map(Number);
    const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, '0')}` };
  };

  const load = () => {
    const { month, month_by, ...params } = filters;
    if (month) {
      const { from, to } = monthRange(month);
      if (month_by === 'issue') { params.issue_from = from; params.issue_to = to; }
      else { params.due_from = from; params.due_to = to; }
    }
    return api.get('/cheques', params).then(setRows).catch(e => toast.error(e.message));
  };
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
    const allocs = full.allocations.map(a => ({ purchase_id: a.purchase_id, allocated_amount: a.allocated_amount }));
    setEditing({ ...full, allocations: allocs });
    setInitialAllocations(allocs);
  };

  const save = async () => {
    const chequeAmt = Number(editing.amount) || 0;
    if (chequeAmt <= 0) {
      toast.error('Cheque amount must be a positive number.');
      return;
    }

    const allocations = editing.allocations.filter(a => a.purchase_id && a.allocated_amount);
    const totalAllocated = allocations.reduce((sum, a) => sum + (Number(a.allocated_amount) || 0), 0);

    if (Math.abs(totalAllocated - chequeAmt) > 0.005) {
      toast.error(`Total allocated amount (${totalAllocated.toFixed(2)}) must equal the cheque amount (${chequeAmt.toFixed(2)}).`);
      return;
    }

    for (const a of allocations) {
      const p = purchases.find(x => x.id === a.purchase_id);
      if (p) {
        const origAlloc = !['bounced', 'cancelled'].includes(editing.status)
          ? (initialAllocations.find(ia => ia.purchase_id === p.id)?.allocated_amount || 0)
          : 0;
        const origOutstanding = Number((Number(p.outstanding) + Number(origAlloc)).toFixed(2));
        const allocatedAmt = Number(a.allocated_amount);
        if (allocatedAmt - origOutstanding > 0.005) {
          toast.error(`Allocation of ${allocatedAmt.toFixed(2)} to invoice ${p.invoice_no || '#' + p.id} exceeds its outstanding balance (${origOutstanding.toFixed(2)}).`);
          return;
        }
      }
    }

    const payload = { ...editing, allocations };
    try {
      if (editing.id) await api.put(`/cheques/${editing.id}`, payload);
      else await api.post('/cheques', payload);
      setEditing(null); toast.success('Cheque saved.'); load();
    } catch (e) { toast.error(e.message); }
  };

  const setStatus = async (c, status) => {
    if (!status) return;
    const warnings = {
      cleared: `Mark cheque ${c.cheque_number} as CLEARED? The amount will be drawn from the savings account and a confirmation SMS will be sent.`,
      bounced: `Mark cheque ${c.cheque_number} as BOUNCED? A bounce alert SMS will be sent.`,
      cancelled: `Cancel cheque ${c.cheque_number}? This is final.`,
    };
    if (warnings[status]) {
      const confirmed = await confirm({
        title: `${status === 'cleared' ? 'Clear' : status === 'bounced' ? 'Bounce' : 'Cancel'} Cheque`,
        message: warnings[status],
        danger: status === 'cancelled' || status === 'bounced'
      });
      if (!confirmed) return;
    }
    try { await api.post(`/cheques/${c.id}/status`, { status }); toast.success(`Cheque ${c.cheque_number} marked ${status.replace('_', ' ')}.`); load(); }
    catch (e) { toast.error(e.message); }
  };

  const remove = async c => {
    const confirmed = await confirm({
      title: 'Delete Cheque',
      message: `Delete cheque ${c.cheque_number}? Only issued/cancelled cheques can be removed.`,
      danger: true,
      confirmText: 'Delete'
    });
    if (!confirmed) return;
    try { await api.del(`/cheques/${c.id}`); toast.success(`Cheque ${c.cheque_number} deleted.`); load(); } catch (e) { toast.error(e.message); }
  };

  const allocTotal = editing ? editing.allocations.reduce((s, a) => s + (Number(a.allocated_amount) || 0), 0) : 0;

  return (
    <>
      <div className="page-head">
        <div><h1>Cheques</h1><div className="sub">Register, allocate and track every cheque through its lifecycle</div></div>
        <button className="btn primary" onClick={() => { setEditing({ ...blank }); setInitialAllocations([]); }}>Register cheque</button>
      </div>
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
        <input type="month" title="Filter by month" value={filters.month} onChange={e => setFilters({ ...filters, month: e.target.value })} />
        {filters.month && (
          <>
            <select value={filters.month_by} onChange={e => setFilters({ ...filters, month_by: e.target.value })}>
              <option value="due">Due in month</option>
              <option value="issue">Issued in month</option>
            </select>
            <button className="btn ghost sm" onClick={() => setFilters({ ...filters, month: '' })}>All time</button>
          </>
        )}
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
              <select value={editing.supplier_id} onChange={e => {
                setEditing({ ...editing, supplier_id: e.target.value ? Number(e.target.value) : '', allocations: [] });
                setInitialAllocations([]);
              }}>
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

          <h3 style={{ fontSize: 14, margin: '18px 0 8px' }}>Allocate to purchases (partial payments)</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: 12.5, marginBottom: 12 }}>
            Allocate parts of this cheque's amount directly to the supplier's outstanding purchases.
          </p>
          {!editing.supplier_id ? (
            <div className="empty" style={{ padding: '16px', fontSize: 13, border: '1px dashed var(--rule)', borderRadius: 'var(--radius)' }}>
              Please select a supplier first to view available invoices.
            </div>
          ) : (() => {
            const visiblePurchases = purchases.filter(p => p.outstanding > 0 || initialAllocations.some(ia => ia.purchase_id === p.id));
            if (visiblePurchases.length === 0) {
              return (
                <div className="empty" style={{ padding: '16px', fontSize: 13, border: '1px dashed var(--rule)', borderRadius: 'var(--radius)' }}>
                  No outstanding purchases found for this supplier.
                </div>
              );
            }
            return (
              <div className="table-wrap" style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--rule)', borderRadius: 'var(--radius)', marginBottom: 10 }}>
                <table style={{ fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Date</th>
                      <th className="num">Total</th>
                      <th className="num">Outstanding</th>
                      <th style={{ width: 140, paddingLeft: 12 }}>Payment Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePurchases.map(p => {
                      const alloc = editing.allocations.find(a => a.purchase_id === p.id);
                      const val = alloc ? alloc.allocated_amount : '';
                      
                      // Calculate original outstanding balance before this cheque was applied:
                      const origAlloc = !['bounced', 'cancelled'].includes(editing.status)
                        ? (initialAllocations.find(ia => ia.purchase_id === p.id)?.allocated_amount || 0)
                        : 0;
                      const origOutstanding = Number((Number(p.outstanding) + Number(origAlloc)).toFixed(2));

                      const handleAllocChange = (newVal) => {
                        let next = [...editing.allocations];
                        const idx = next.findIndex(a => a.purchase_id === p.id);
                        if (idx >= 0) {
                          if (newVal === '' || Number(newVal) <= 0) {
                            next.splice(idx, 1);
                          } else {
                            next[idx] = { ...next[idx], allocated_amount: newVal };
                          }
                        } else if (newVal !== '' && Number(newVal) > 0) {
                          next.push({ purchase_id: p.id, allocated_amount: newVal });
                        }
                        setEditing({ ...editing, allocations: next });
                      };

                      return (
                        <tr key={p.id}>
                          <td>{p.invoice_no || `#${p.id}`}</td>
                          <td className="mono">{p.purchase_date}</td>
                          <td className="num"><Money value={p.total_amount} /></td>
                          <td className="num" style={{ fontWeight: 500, color: origOutstanding > 0 ? 'var(--amber)' : 'inherit' }}>
                            <Money value={origOutstanding} />
                          </td>
                          <td style={{ padding: '6px 12px' }}>
                            <input
                              type="number"
                              min="0"
                              max={origOutstanding}
                              step="0.01"
                              placeholder="0.00"
                              value={val}
                              onChange={e => handleAllocChange(e.target.value)}
                              style={{ padding: '5px 8px', fontSize: 13, height: 30 }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
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
