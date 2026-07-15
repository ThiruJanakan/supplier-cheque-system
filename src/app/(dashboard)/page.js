"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/api/client';
import { Money, Stamp, ChequeNo } from '@/components/ui';

const thisMonth = new Date().toISOString().slice(0, 7);

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [account, setAccount] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/reports/monthly', { month: thisMonth }), api.get('/savings/account')])
      .then(([s, a]) => { setSummary(s); setAccount(a); })
      .catch(e => setError(e.message));
  }, []);

  if (error) return <div className="alert-error">{error}</div>;
  if (!summary || !account) return <div className="empty">Loading…</div>;
  const cs = summary.chequeStats;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">Position for {thisMonth}</div>
        </div>
        <Link href="/cheques" className="btn primary">Register a cheque</Link>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 14 }}>
        <div className="card stat"><div className="label">Savings balance</div><div className="value"><Money value={account.balance} /></div>
          <div className="hint">Available after pending cheques: <Money value={account.available_after_commitments} /></div></div>
        <div className="card stat"><div className="label">Supplier spending · month</div><div className="value"><Money value={summary.spendTotal} /></div></div>
        <div className="card stat"><div className="label">Revenue deposited · month</div><div className="value"><Money value={summary.revenueTotal} /></div></div>
        <div className="card stat"><div className="label">Cheques · month</div>
          <div className="value">{cs.total_issued}</div>
          <div className="hint">{cs.pending_clearance} pending · {cs.cleared} cleared · {cs.bounced} bounced</div></div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-pad" style={{ borderBottom: '1px solid var(--rule)' }}><h2 style={{ fontSize: 16 }}>Upcoming due dates</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Due</th><th>Cheque</th><th>Supplier</th><th className="num">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {summary.upcoming.length === 0 && <tr><td colSpan={5} className="empty">No pending cheques. Clear inbox.</td></tr>}
                {summary.upcoming.slice(0, 8).map(c => (
                  <tr key={c.id}>
                    <td className="mono">{c.due_date}</td>
                    <td><ChequeNo>{c.cheque_number}</ChequeNo></td>
                    <td>{c.supplier_name}</td>
                    <td className="num"><Money value={c.amount} /></td>
                    <td><Stamp status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-pad" style={{ borderBottom: '1px solid var(--rule)' }}><h2 style={{ fontSize: 16 }}>Spending by supplier · {thisMonth}</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Supplier</th><th className="num">Total</th></tr></thead>
              <tbody>
                {summary.spendBySupplier.length === 0 && <tr><td colSpan={2} className="empty">No purchases recorded this month.</td></tr>}
                {summary.spendBySupplier.map(r => (
                  <tr key={r.id}><td>{r.name}</td><td className="num"><Money value={r.total} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
