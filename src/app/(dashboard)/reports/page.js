"use client";
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Money, Stamp, ChequeNo } from '@/components/ui';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { jsPDF } from 'jspdf';

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

  const handleExportPdf = () => {
    try {
      const doc = new jsPDF();
      const currency = 'LKR'; 
      const fmt = n => `${currency} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      
      const formatMonthWords = (monthStr) => {
        const [year, month] = monthStr.split('-');
        const date = new Date(Number(year), Number(month) - 1, 1);
        return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      };

      const monthName = formatMonthWords(month);
      const generatedTime = new Date().toLocaleString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      // ---- Colors ----
      const cPrimary = [24, 92, 69]; // Banker Green
      const cMuted = [100, 110, 120];
      const cDark = [30, 40, 45];
      
      // ---- Header Layout ----
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(...cPrimary);
      doc.text("CHEQUE MANAGER", 15, 22);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...cMuted);
      doc.text("SUPPLIER PAYMENTS & LEDGER REPORT", 15, 27);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...cDark);
      doc.text(`REPORT PERIOD: ${monthName.toUpperCase()}`, 195, 22, { align: 'right' });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...cMuted);
      doc.text(`Generated: ${generatedTime}`, 195, 27, { align: 'right' });

      // Solid Divider line
      doc.setDrawColor(...cPrimary);
      doc.setLineWidth(1);
      doc.line(15, 32, 195, 32);

      // ---- KPI Metrics Box Cards ----
      // Card 1
      doc.setFillColor(245, 248, 246);
      doc.roundedRect(15, 38, 85, 28, 3, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...cMuted);
      doc.text("TOTAL SUPPLIER SPENDING", 20, 44);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(...cDark);
      doc.text(fmt(summary.spendTotal), 20, 56);

      // Card 2
      doc.setFillColor(245, 248, 246);
      doc.roundedRect(110, 38, 85, 28, 3, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...cMuted);
      doc.text("TOTAL REVENUE DEPOSITED", 115, 44);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(...cDark);
      doc.text(fmt(summary.revenueTotal), 115, 56);

      // ---- Cheques Stats Block ----
      doc.setDrawColor(230, 235, 232);
      doc.setLineWidth(0.5);
      doc.line(15, 74, 195, 74);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...cPrimary);
      doc.text("CHEQUES ISSUED:", 15, 82);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...cDark);
      doc.text(String(cs.total_issued), 55, 82);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...cMuted);
      doc.text(`(${cs.pending_clearance} Pending  ·  ${cs.cleared} Cleared  ·  ${cs.bounced} Bounced)`, 70, 82);

      doc.line(15, 88, 195, 88);

      // ---- Spending by Supplier Section ----
      let y = 98;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...cPrimary);
      doc.text("SPENDING BY SUPPLIER", 15, y);

      y += 6;
      doc.setDrawColor(200, 210, 205);
      doc.setLineWidth(0.5);
      doc.line(15, y, 195, y); // header underline
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...cMuted);
      y += 5;
      doc.text("SUPPLIER NAME", 15, y);
      doc.text("TOTAL SPENDING", 195, y, { align: 'right' });

      y += 3;
      doc.line(15, y, 195, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...cDark);
      
      if (summary.spendBySupplier.length === 0) {
        y += 8;
        doc.text("No purchases recorded this month.", 15, y);
      } else {
        summary.spendBySupplier.forEach(r => {
          y += 8;
          doc.text(r.name, 15, y);
          doc.setFont('helvetica', 'bold');
          doc.text(fmt(r.total), 195, y, { align: 'right' });
          doc.setFont('helvetica', 'normal');
          
          // Draw thin separation line
          doc.setDrawColor(240, 240, 240);
          doc.line(15, y + 2, 195, y + 2);
        });
      }

      // ---- Upcoming Cheques Section ----
      y += 18;
      
      // Page break check
      if (y > 200) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...cPrimary);
      doc.text("UPCOMING CHEQUE DUE DATES", 15, y);

      y += 6;
      doc.setDrawColor(200, 210, 205);
      doc.line(15, y, 195, y); // header underline
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...cMuted);
      y += 5;
      doc.text("DUE DATE", 15, y);
      doc.text("CHEQUE NO", 42, y);
      doc.text("SUPPLIER", 75, y);
      doc.text("STATUS", 145, y);
      doc.text("AMOUNT", 195, y, { align: 'right' });

      y += 3;
      doc.line(15, y, 195, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...cDark);

      if (calendar.length === 0) {
        y += 8;
        doc.text("No pending cheques scheduled.", 15, y);
      } else {
        calendar.forEach(c => {
          y += 8;
          if (y > 275) {
            doc.addPage();
            y = 20;
            // Redraw table headers on new page
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(...cMuted);
            doc.text("DUE DATE", 15, y);
            doc.text("CHEQUE NO", 42, y);
            doc.text("SUPPLIER", 75, y);
            doc.text("STATUS", 145, y);
            doc.text("AMOUNT", 195, y, { align: 'right' });
            y += 3;
            doc.line(15, y, 195, y);
            y += 8;
          }

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...cDark);
          doc.text(c.due_date, 15, y);
          doc.text(c.cheque_number, 42, y);
          doc.text(c.supplier_name.length > 32 ? c.supplier_name.slice(0, 30) + '...' : c.supplier_name, 75, y);
          
          // Status color
          const status = c.status.toLowerCase();
          if (status === 'cleared') {
            doc.setTextColor(16, 124, 65); // Green
            doc.setFont('helvetica', 'bold');
            doc.text("CLEARED", 145, y);
          } else if (status === 'bounced') {
            doc.setTextColor(185, 28, 28); // Red
            doc.setFont('helvetica', 'bold');
            doc.text("BOUNCED", 145, y);
          } else if (status === 'issued') {
            doc.setTextColor(29, 78, 216); // Blue
            doc.setFont('helvetica', 'bold');
            doc.text("ISSUED", 145, y);
          } else {
            doc.setTextColor(217, 119, 6); // Amber
            doc.setFont('helvetica', 'bold');
            doc.text("PENDING", 145, y);
          }
          
          doc.setTextColor(...cDark);
          doc.setFont('helvetica', 'bold');
          doc.text(fmt(c.amount), 195, y, { align: 'right' });

          doc.setDrawColor(245, 245, 245);
          doc.line(15, y + 2, 195, y + 2);
        });
      }

      // ---- Footer Page Numbers ----
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(...cMuted);
        doc.text(`Page ${i} of ${totalPages}`, 105, 287, { align: 'center' });
      }

      doc.save(`report-${month}.pdf`);
    } catch (err) {
      alert('Failed to generate PDF: ' + err.message);
    }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Reports</h1><div className="sub">Monthly summary, trends and exports</div></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
          <button className="btn ghost" onClick={() => api.download('/reports/export/excel', { month }, `report-${month}.xlsx`)}>Export Excel</button>
          <button className="btn ghost" onClick={handleExportPdf}>Export PDF</button>
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
          <div className="mobile-due-list">
            <h3 style={{ fontSize: 14, marginBottom: 12, borderBottom: '1px solid var(--rule)', paddingBottom: '6px' }}>Cheques due in {month}</h3>
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
                      <div>
                        <span style={{ color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Cheque</span>
                        <ChequeNo>{c.cheque_number}</ChequeNo>
                      </div>
                      <div>
                        <span style={{ color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Supplier</span>
                        <strong>{c.supplier_name}</strong>
                      </div>
                      <div style={{ marginTop: 4, borderTop: '1px solid var(--paper)', paddingTop: 6 }}>
                        <span style={{ color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Amount</span>
                        <span style={{ fontWeight: 700 }}><Money value={c.amount} /></span>
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
