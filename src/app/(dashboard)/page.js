"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/api/client';
import { Money, Stamp, ChequeNo, Loader } from '@/components/ui';

const thisMonth = new Date().toISOString().slice(0, 7);

function formatMonth(monthStr) {
  const [year, month] = monthStr.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

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
  if (!summary || !account) return <Loader text="Loading dashboard" />;
  const cs = summary.chequeStats;

  return (
    <>
      <div className="dashboard-head" style={{ marginBottom: 20 }}>
        <h1>Dashboard</h1>
        <div className="sub" style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 4 }}>
          Financial position · {formatMonth(thisMonth)}
        </div>
        <Link href="/cheques" className="btn primary register-btn">
          + Register cheque
        </Link>
      </div>

      <div className="kpi-container">
        {/* Card 1: Savings balance card */}
        <div className="card kpi-card">
          <div className="kpi-label">Savings balance</div>
          <div className="kpi-val"><Money value={account.balance} /></div>
          <div className="kpi-hint">Available after pending: <Money value={account.available_after_commitments} /></div>
        </div>

        {/* Card 2: Revenue deposited */}
        <div className="card kpi-card">
          <div className="kpi-label">Revenue deposited</div>
          <div className="kpi-val"><Money value={summary.revenueTotal} /></div>
          <div className="kpi-hint" style={{ color: 'var(--banker)', fontWeight: 500 }}>Sales revenue this month</div>
        </div>

        {/* Card 3: Cheques this month stats card */}
        <div className="card kpi-card">
          <div className="kpi-label">Cheques this month ({cs.total_issued})</div>
          <div className="cheque-stats-compact">
            <div className="stat-block">
              <span className="stat-block-val">{cs.pending_clearance}</span>
              <span className="stat-block-lbl">Pending</span>
            </div>
            <div className="stat-block">
              <span className="stat-block-val">{cs.cleared}</span>
              <span className="stat-block-lbl">Cleared</span>
            </div>
            <div className="stat-block">
              <span className="stat-block-val">{cs.bounced}</span>
              <span className="stat-block-lbl">Bounced</span>
            </div>
          </div>
        </div>

        {/* Card 4: Total supplier spend */}
        <div className="card kpi-card">
          <div className="kpi-label">Total supplier spend</div>
          <div className="kpi-val"><Money value={summary.spendTotal} /></div>
          <div className="kpi-hint">Accrual spending (Paid + Payable)</div>
        </div>

        {/* Card 5: Actually paid */}
        <div className="card kpi-card" style={{ borderLeft: '3px solid var(--banker)' }}>
          <div className="kpi-label">Actually paid</div>
          <div className="kpi-val" style={{ color: 'var(--banker)' }}><Money value={summary.paidTotal} /></div>
          <div className="kpi-hint">Direct cash & cleared cheques</div>
        </div>

        {/* Card 6: Have to pay */}
        <div className="card kpi-card" style={{ borderLeft: '3px solid var(--amber)' }}>
          <div className="kpi-label">Have to pay</div>
          <div className="kpi-val" style={{ color: summary.outstandingTotal > 0.005 ? 'var(--amber)' : 'var(--banker)' }}><Money value={summary.outstandingTotal} /></div>
          <div className="kpi-hint">Total outstanding credit due</div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-pad" style={{ borderBottom: '1px solid var(--rule)' }}><h2 style={{ fontSize: 16 }}>Upcoming due dates</h2></div>
          
          {/* Desktop Table View */}
          <div className="table-wrap desktop-only-view">
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

          {/* Mobile Card View */}
          <div className="mobile-only-view cheques-card-list">
            {summary.upcoming.length === 0 && <div className="empty" style={{ padding: 16 }}>No pending cheques. Clear inbox.</div>}
            {summary.upcoming.slice(0, 8).map(c => (
              <div key={c.id} className="cheque-card">
                <div className="cheque-card-header">
                  <span className="chq-no">{c.cheque_number}</span>
                  <Stamp status={c.status} />
                </div>
                <div className="cheque-card-supplier">
                  {c.supplier_name}
                </div>
                <div className="cheque-card-footer">
                  <span className="cheque-card-date">Due: {c.due_date}</span>
                  <span className="cheque-card-amount"><Money value={c.amount} /></span>
                </div>
              </div>
            ))}
            {summary.upcoming.length > 0 && (
              <div style={{ textAlign: 'center', padding: '14px 16px', borderTop: '1px solid var(--rule)' }}>
                <Link href="/cheques" style={{ color: 'var(--banker)', fontWeight: 600, textDecoration: 'none', fontSize: 13 }}>
                  View all cheques →
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-pad" style={{ borderBottom: '1px solid var(--rule)', marginBottom: 12 }}><h2 style={{ fontSize: 16 }}>Spending by supplier · {formatMonth(thisMonth)}</h2></div>
          
          <div className="supplier-spend-list" style={{ padding: '0 18px 18px' }}>
            {summary.spendBySupplier.length === 0 && <div className="empty">No purchases recorded this month.</div>}
            {summary.spendBySupplier.slice(0, 5).map(r => {
              const maxSpend = Math.max(...summary.spendBySupplier.map(s => s.total), 1);
              const pct = (r.total / maxSpend) * 100;
              return (
                <div key={r.id} className="supplier-spend-row" style={{ marginBottom: 14 }}>
                  <div className="supplier-spend-info" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13.5 }}>
                    <strong>{r.name}</strong>
                    <span className="mono" style={{ fontWeight: 500 }}><Money value={r.total} /></span>
                  </div>
                  <div className="supplier-spend-bar-bg" style={{ height: 8, background: '#e7ecef', borderRadius: 4, overflow: 'hidden' }}>
                    <div className="supplier-spend-bar" style={{ height: '100%', background: 'var(--banker)', width: `${pct}%`, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
            
            {summary.spendBySupplier.length > 0 && (
              <div style={{ textAlign: 'center', marginTop: 18, borderTop: '1px solid var(--rule)', paddingTop: 12 }}>
                <Link href="/suppliers" style={{ color: 'var(--banker)', fontWeight: 600, textDecoration: 'none', fontSize: 13 }}>
                  View all suppliers →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
