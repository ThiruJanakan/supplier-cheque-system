"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/api/client';
import { Money, CreditChip, Loader } from '@/components/ui';

export default function CreditDues() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [error, setError] = useState('');

  const load = () => api.get('/credit', { supplier_id: supplierId }).then(setData).catch(e => setError(e.message));
  useEffect(() => { load(); }, [supplierId]);
  useEffect(() => { api.get('/suppliers').then(setSuppliers); }, []);

  if (!data && !error) return <div style={{ marginTop: 40 }}><Loader text="Loading dues" /></div>;

  return (
    <>
      <div className="page-head">
        <div><h1>Credit dues</h1><div className="sub">Pending supplier credit payments, grouped by supplier</div></div>
      </div>
      {error && <div className="alert-error">{error}</div>}

      {data && (
        <>
          <div className="grid cols-3" style={{ marginBottom: 16 }}>
            <Stat label="Open purchases" value={data.grand.count} />
            <Stat label="Total paid" value={<Money value={data.grand.paid} />} />
            <Stat label="Total outstanding" value={<Money value={data.grand.outstanding} />} amber />
          </div>

          <div className="toolbar">
            <select value={supplierId} onChange={e => setSupplierId(e.target.value)}>
              <option value="">All suppliers</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {data.groups.length === 0 && <div className="card card-pad empty">No pending credit payments. Everything is settled. 🎉</div>}

          {data.groups.map(g => (
            <div className="card card-pad" key={g.supplier_id} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <h2 style={{ fontSize: 16, margin: 0 }}>{g.supplier_name}</h2>
                <div className="muted" style={{ fontSize: 13 }}>
                  Outstanding <strong style={{ color: 'var(--amber)' }}><Money value={g.outstanding} /></strong> of <Money value={g.total} />
                </div>
              </div>
              <div className="table-wrap responsive-table">
                <table>
                  <thead><tr><th>Invoice</th><th>Purchase date</th><th>Due date</th><th>Status</th><th className="num">Total</th><th className="num">Paid</th><th className="num">Outstanding</th></tr></thead>
                  <tbody>
                    {g.rows.map(r => (
                      <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/purchases/${r.id}`)}>
                        <td className="mono" data-label="Invoice">{r.invoice_no || `#${r.id}`}</td>
                        <td className="mono" data-label="Purchase date">{r.purchase_date}</td>
                        <td className="mono" data-label="Due date">{r.due_date || '—'}</td>
                        <td data-label="Status"><CreditChip status={r.status} days={r.days_to_due} /></td>
                        <td className="num" data-label="Total"><Money value={r.total_amount} /></td>
                        <td className="num" data-label="Paid"><Money value={r.paid_amount} /></td>
                        <td className="num" data-label="Outstanding" style={{ color: 'var(--amber)', fontWeight: 600 }}><Money value={r.outstanding} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function Stat({ label, value, amber }) {
  return (
    <div className="card card-pad">
      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: amber ? 'var(--amber)' : 'inherit' }}>{value}</div>
    </div>
  );
}
