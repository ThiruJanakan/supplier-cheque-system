"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/api/client';
import Modal from '@/components/Modal';
import { Money, Field, MoneyInput, CreditChip, Loader } from '@/components/ui';
import { useUI } from '@/context/UIContext';

const today = () => new Date().toISOString().slice(0, 10);
const blankPay = { amount: '', method: 'cash', paid_on: today(), reference: '', notes: '' };
const METHOD_LABEL = { cash: 'Cash', cheque: 'Cheque', bank_transfer: 'Bank transfer' };

export default function PurchaseDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { toast, confirm } = useUI();
  const [p, setP] = useState(null);
  const [pay, setPay] = useState(null); // null | {id?, ...}

  const load = () => api.get(`/purchases/${id}`).then(setP).catch(e => toast.error(e.message));
  useEffect(() => { load(); }, [id]);

  const savePay = async () => {
    if (pay.method === 'cheque' && (!pay.reference || !pay.reference.trim())) {
      toast.error('Cheque number is required for cheque payments.');
      return;
    }
    try {
      const isNew = !pay.id;
      const updated = pay.id
        ? await api.put(`/purchases/${id}/payments/${pay.id}`, pay)
        : await api.post(`/purchases/${id}/payments`, pay);
      setP(updated); 
      setPay(null);
      toast.success(isNew ? 'Payment recorded successfully.' : 'Payment updated.');
    } catch (e) { toast.error(e.message); }
  };
  const removePay = async row => {
    const confirmed = await confirm({
      title: 'Delete Payment',
      message: `Delete this ${METHOD_LABEL[row.method] || row.method} payment of ${row.amount}?`,
      danger: true,
      confirmText: 'Delete'
    });
    if (!confirmed) return;
    try { 
      const updated = await api.del(`/purchases/${id}/payments/${row.id}`); 
      setP(updated); 
      toast.success('Payment deleted.'); 
    } catch (e) { toast.error(e.message); }
  };

  if (!p) return <div style={{ marginTop: 40 }}><Loader text="Loading purchase" /></div>;

  const s = p.supplier || {};

  return (
    <>
      <div className="page-head">
        <div>
          <div style={{ marginBottom: 4 }}>
            <Link href="/purchases" className="muted" style={{ fontSize: 12.5 }}>← Back to purchases</Link>
          </div>
          <h1>{p.invoice_no ? `Invoice ${p.invoice_no}` : `Purchase #${p.id}`}</h1>
          <div className="sub">{p.supplier_name} · {p.purchase_date}</div>
        </div>
        <button className="btn primary" onClick={() => setPay({ ...blankPay })} disabled={p.outstanding <= 0.005}>
          Record payment
        </button>
      </div>

      {/* Amount summary */}
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <div className="card card-pad">
          <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Total amount</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}><Money value={p.total_amount} /></div>
        </div>
        <div className="card card-pad">
          <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Paid</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--banker)' }}><Money value={p.paid_amount} /></div>
        </div>
        <div className="card card-pad">
          <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>Outstanding</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: p.outstanding > 0.005 ? 'var(--amber)' : 'var(--banker)' }}><Money value={p.outstanding} /></div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        {/* Credit / purchase details */}
        <div className="card card-pad">
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Credit details</h2>
          <dl className="detail-list">
            <Row label="Purchase date" value={p.purchase_date} mono />
            <Row label="Credit period" value={p.credit_period_days != null ? `${p.credit_period_days} days` : '—'} />
            <Row label="Due date" value={
              p.due_date
                ? <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                    <span className="mono">{p.due_date}</span>
                    {p.outstanding > 0.005 && <CreditChip status={p.status} days={p.days_to_due} />}
                  </span>
                : '—'
            } />
            <Row label="Description" value={p.description || '—'} />
          </dl>
        </div>

        {/* Supplier details */}
        <div className="card card-pad">
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Supplier</h2>
          <dl className="detail-list">
            <Row label="Name" value={s.name || p.supplier_name} />
            <Row label="Contact" value={s.contact_person || '—'} />
            <Row label="Phone" value={s.phone || '—'} mono />
            <Row label="Bank" value={s.bank_name ? `${s.bank_name}${s.bank_account_no ? ' · ' + s.bank_account_no : ''}` : '—'} />
          </dl>
        </div>
      </div>

      {/* Direct payments */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Payments</h2>
          <button className="btn ghost sm" onClick={() => setPay({ ...blankPay })} disabled={p.outstanding <= 0.005}>Add payment</button>
        </div>
        <div className="table-wrap responsive-table">
          <table>
            <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th className="num">Amount</th><th></th></tr></thead>
            <tbody>
              {p.payments.length === 0 && <tr><td colSpan={5} className="empty">No cash/direct payments yet.</td></tr>}
              {p.payments.map(row => (
                <tr key={row.id}>
                  <td className="mono" data-label="Date">{row.paid_on}</td>
                  <td data-label="Method">{METHOD_LABEL[row.method] || row.method}</td>
                  <td data-label="Reference" className="muted">{row.reference || '—'}</td>
                  <td className="num" data-label="Amount"><Money value={row.amount} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" onClick={() => setPay({ ...row })}>Edit</button>{' '}
                    <button className="btn danger sm" onClick={() => removePay(row)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {p.paid_payments > 0 && (
          <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Direct payments total: <Money value={p.paid_payments} /></div>
        )}
      </div>

      {/* Cheque allocations (from the Cheques module) */}
      {p.allocations.length > 0 && (
        <div className="card card-pad">
          <h2 style={{ fontSize: 16, marginBottom: 4 }}>Cheque payments</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>Allocated from the Cheques module (read-only here).</p>
          <div className="table-wrap responsive-table">
            <table>
              <thead><tr><th>Cheque no</th><th>Bank</th><th>Due</th><th>Status</th><th className="num">Allocated</th></tr></thead>
              <tbody>
                {p.allocations.map(a => (
                  <tr key={a.id}>
                    <td className="mono" data-label="Cheque no">
                      {a.cheque_id ? <Link href="/cheques">{a.cheque_number}</Link> : (a.cheque_number || '—')}
                    </td>
                    <td data-label="Bank" className="muted">{a.bank_name || '—'}</td>
                    <td className="mono" data-label="Due">{a.cheque_due_date || '—'}</td>
                    <td data-label="Status">{(a.cheque_status || '').replace('_', ' ') || '—'}</td>
                    <td className="num" data-label="Allocated"><Money value={a.allocated_amount} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pay && (
        <Modal title={pay.id ? 'Edit payment' : 'Record payment'} onClose={() => setPay(null)}
          footer={<><button className="btn ghost" onClick={() => setPay(null)}>Cancel</button>
                   <button className="btn primary" onClick={savePay}>Save payment</button></>}>
          <div className="grid cols-2">
            <Field label="Amount *"><MoneyInput value={pay.amount} onChange={v => setPay({ ...pay, amount: v })} placeholder="0.00" /></Field>
            <Field label="Method *">
              <select value={pay.method} onChange={e => setPay({ ...pay, method: e.target.value })}>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
            </Field>
            <Field label="Payment date *"><input type="date" value={pay.paid_on} onChange={e => setPay({ ...pay, paid_on: e.target.value })} /></Field>
            <Field label={pay.method === 'cheque' ? "Cheque number *" : "Reference"}>
              <input
                value={pay.reference || ''}
                onChange={e => setPay({ ...pay, reference: e.target.value })}
                placeholder={pay.method === 'cheque' ? "Enter cheque number" : "Cheque no / receipt / txn id"}
              />
            </Field>
          </div>
          <Field label="Notes"><textarea rows={2} value={pay.notes || ''} onChange={e => setPay({ ...pay, notes: e.target.value })} /></Field>
          <div className="muted" style={{ fontSize: 12.5 }}>Outstanding before this payment: <Money value={p.outstanding + (pay.id ? Number(p.payments.find(x => x.id === pay.id)?.amount || 0) : 0)} /></div>
        </Modal>
      )}
    </>
  );
}

function Row({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--rule)' }}>
      <span className="muted" style={{ fontSize: 12.5 }}>{label}</span>
      <span className={mono ? 'mono' : ''} style={{ textAlign: 'right' }}>{value}</span>
    </div>
  );
}
