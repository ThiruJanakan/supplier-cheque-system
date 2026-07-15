"use client";
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Money, Stamp, ChequeNo } from '@/components/ui';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

const thisMonth = new Date().toISOString().slice(0, 7);

function Calendar({ month, items }) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const startPad = first.getDay();
  const days = new Date(y, m, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);
  const byDay = {};
  
  items.forEach(c => { 
    byDay[c.due_date] = byDay[c.due_date] || [];
    byDay[c.due_date].push(c); 
  });
  
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  
  const cls = s => ['cleared'].includes(s) ? 'cleared' : ['bounced'].includes(s) ? 'bounced' : 'pending';
  
  return (
    <div className="cal">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="dow">{d}</div>)}
      {cells.map((d, i) => {
        if (!d) return <div key={i} className="day other" />;
        const date = `${month}-${String(d).padStart(2, '0')}`;
        return (
          <div key={i} className={`day ${date === todayStr ? 'today' : ''}`}>
            <div className="d">{d}</div>
            {(byDay[date] || []).map(c => (
              <div key={c.id} className={`due ${cls(c.status)}`} title={`${c.supplier_name} · ${c.amount}`}>
                {c.cheque_number}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function Reports() {
  const [month, setMonth] = useState(thisMonth);
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [growth, setGrowth] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/reports/monthly', { month }),
      api.get('/reports/trends', { months: 6 }),
      api.get('/reports/savings-growth'),
      api.get('/reports/calendar', { month }),
    ]).then(([s, t, g, c]) => { setSummary(s); setTrends(t); setGrowth(g); setCalendar(c); })
      .catch(e => setError(e.message));
  }, [month]);

  if (error) return <div className="alert-error">{error}</div>;
  if (!summary) return <div className="empty">Loading…</div>;
  const cs = summary.chequeStats;

  return (
    <>
      <div className="page-head">
        <div><h1>Reports</h1><div className="sub">Monthly summary, trends and exports</div></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
          <button className="btn ghost" onClick={() => api.download('/reports/export/excel', { month }, `report-${month}.xlsx`)}>Export Excel</button>
          <button className="btn ghost" onClick={() => api.download('/reports/export/pdf', { month }, `report-${month}.pdf`)}>Export PDF</button>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 14 }}>
        <div className="card stat"><div className="label">Supplier spending</div><div className="value"><Money value={summary.spendTotal} /></div></div>
        <div className="card stat"><div className="label">Revenue deposited</div><div className="value"><Money value={summary.revenueTotal} /></div></div>
        <div className="card stat"><div className="label">Cheques issued</div><div className="value">{cs.total_issued}</div>
          <div className="hint"><Money value={cs.total_value} /> total value</div></div>
        <div className="card stat"><div className="label">Clearance</div>
          <div className="value">{cs.cleared}<span className="muted" style={{ fontSize: 14 }}> / {cs.pending_clearance} pending / {cs.bounced} bounced</span></div></div>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 14 }}>
        <div className="card card-pad">
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>Spending vs revenue · last 6 months</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
              <XAxis dataKey="month" fontSize={11} /><YAxis fontSize={11} width={70} />
              <Tooltip />
              <Legend />
              <Bar dataKey="spending" name="Supplier spending" fill="#a9761f" radius={[3, 3, 0, 0]} />
              <Bar dataKey="revenue" name="Sales revenue" fill="#1f6f54" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card card-pad">
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>Savings balance growth</h2>
          {growth.length === 0 ? <div className="empty">No savings activity yet.</div> : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                <XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} width={70} />
                <Tooltip />
                <Area dataKey="balance" name="Balance" stroke="#1f6f54" fill="#e4f0eb" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card card-pad">
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>Due date calendar · {month}</h2>
          <Calendar month={month} items={calendar} />

          {/* Mobile-only list of due cheques */}
          <div className="mobile-due-list" style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 14, marginBottom: 10, borderBottom: '1px solid var(--rule)', paddingBottom: '6px' }}>Cheques due in {month}</h3>
            {calendar.length === 0 ? (
              <div className="empty" style={{ padding: 16 }}>No cheques due this month.</div>
            ) : (
              <div className="due-items-list">
                {calendar.map(c => (
                  <div key={c.id} className="due-item-card">
                    <div className="due-item-header">
                      <span className="mono" style={{ fontWeight: 600 }}>Due: {c.due_date}</span>
                      <Stamp status={c.status} />
                    </div>
                    <div className="due-item-body">
                      <div>Cheque: <ChequeNo>{c.cheque_number}</ChequeNo></div>
                      <div>Supplier: <strong>{c.supplier_name}</strong></div>
                      <div style={{ gridColumn: 'span 2', marginTop: 4 }}>
                        Amount: <Money value={c.amount} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-pad" style={{ borderBottom: '1px solid var(--rule)' }}><h2 style={{ fontSize: 16 }}>Spending per supplier · {month}</h2></div>
          <div className="table-wrap responsive-table">
            <table>
              <thead><tr><th>Supplier</th><th className="num">Total spent</th></tr></thead>
              <tbody>
                {summary.spendBySupplier.length === 0 && <tr><td colSpan={2} className="empty">No purchases this month.</td></tr>}
                {summary.spendBySupplier.map(r => (
                  <tr key={r.id}>
                    <td data-label="Supplier">{r.name}</td>
                    <td className="num" data-label="Total spent"><Money value={r.total} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
