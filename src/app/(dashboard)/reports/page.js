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

      // ---- Color Constants ----
      const cPrimary = [24, 92, 69]; // Banker Green (#185c45)
      const cMuted = [107, 114, 128]; // Muted Slate Gray (#6b7280)
      const cDark = [17, 24, 39]; // Bold Dark Gray (#111827)
      
      // ---- Title Banner Block ----
      doc.setFillColor(...cPrimary);
      doc.roundedRect(15, 15, 180, 24, 2, 2, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text("CHEQUE MANAGER · PERFORMANCE REPORT", 20, 25);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(`Generated on: ${generatedTime}`, 20, 32);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(monthName.toUpperCase(), 190, 29, { align: 'right' });

      // ---- KPI Summary Cards ----
      // Card 1: Supplier Spending
      doc.setFillColor(249, 250, 251);
      doc.setDrawColor(229, 231, 235);
      doc.roundedRect(15, 45, 87, 28, 2, 2, 'FD');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...cMuted);
      doc.text("TOTAL SUPPLIER SPENDING", 20, 52);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...cDark);
      doc.text(fmt(summary.spendTotal), 20, 64);

      // Card 2: Revenue Deposited
      doc.setFillColor(249, 250, 251);
      doc.setDrawColor(229, 231, 235);
      doc.roundedRect(108, 45, 87, 28, 2, 2, 'FD');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...cMuted);
      doc.text("TOTAL REVENUE DEPOSITED", 113, 52);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...cDark);
      doc.text(fmt(summary.revenueTotal), 113, 64);

      // ---- Card 3: Cheques Stats Summary ----
      doc.setFillColor(249, 250, 251);
      doc.setDrawColor(229, 231, 235);
      doc.roundedRect(15, 79, 180, 20, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...cMuted);
      doc.text("CHEQUES STATUS BREAKDOWN (THIS MONTH)", 20, 85);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...cDark);
      doc.text(`TOTAL ISSUED: ${cs.total_issued}`, 20, 93);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(217, 119, 6); // Amber
      doc.text(`Pending: ${cs.pending_clearance}`, 70, 93);
      
      doc.setTextColor(16, 124, 65); // Green
      doc.text(`Cleared: ${cs.cleared}`, 115, 93);
      
      doc.setTextColor(185, 28, 28); // Red
      doc.text(`Bounced: ${cs.bounced}`, 160, 93);

      // ---- Spending by Supplier Table ----
      let y = 108;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...cPrimary);
      doc.text("SPENDING BY SUPPLIER", 15, y);

      y += 4;
      // Header fill
      doc.setFillColor(...cPrimary);
      doc.rect(15, y, 180, 7, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("SUPPLIER NAME", 20, y + 4.5);
      doc.text("TOTAL SPENDING", 190, y + 4.5, { align: 'right' });

      y += 7;

      if (summary.spendBySupplier.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...cDark);
        y += 8;
        doc.text("No purchases recorded this month.", 20, y);
      } else {
        summary.spendBySupplier.forEach((r, idx) => {
          // Zebra striping background
          if (idx % 2 === 1) {
            doc.setFillColor(249, 250, 251);
            doc.rect(15, y, 180, 8, 'F');
          }
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(...cDark);
          doc.text(r.name, 20, y + 5.5);
          
          doc.setFont('helvetica', 'bold');
          doc.text(fmt(r.total), 190, y + 5.5, { align: 'right' });
          
          // Draw thin separation line
          doc.setDrawColor(243, 244, 246);
          doc.line(15, y + 8, 195, y + 8);
          y += 8;
        });
      }

      // ---- Upcoming Cheques Table ----
      y += 14;
      
      // Page break check
      if (y > 200) {
        doc.addPage();
        y = 15;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...cPrimary);
      doc.text("UPCOMING CHEQUE DUE DATES", 15, y);

      y += 4;
      
      // Header fill
      doc.setFillColor(...cPrimary);
      doc.rect(15, y, 180, 7, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("DUE DATE", 20, y + 4.5);
      doc.text("CHEQUE NO", 45, y + 4.5);
      doc.text("SUPPLIER", 78, y + 4.5);
      doc.text("STATUS", 145, y + 4.5);
      doc.text("AMOUNT", 190, y + 4.5, { align: 'right' });

      y += 7;

      if (calendar.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...cDark);
        y += 8;
        doc.text("No pending cheques scheduled.", 20, y);
      } else {
        calendar.forEach((c, idx) => {
          // Page split check
          if (y > 270) {
            doc.addPage();
            y = 15;
            // Redraw table headers on new page
            doc.setFillColor(...cPrimary);
            doc.rect(15, y, 180, 7, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            doc.text("DUE DATE", 20, y + 4.5);
            doc.text("CHEQUE NO", 45, y + 4.5);
            doc.text("SUPPLIER", 78, y + 4.5);
            doc.text("STATUS", 145, y + 4.5);
            doc.text("AMOUNT", 190, y + 4.5, { align: 'right' });
            y += 7;
          }

          // Zebra striping background
          if (idx % 2 === 1) {
            doc.setFillColor(249, 250, 251);
            doc.rect(15, y, 180, 8, 'F');
          }

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(...cDark);
          
          doc.text(c.due_date, 20, y + 5.5);
          doc.text(c.cheque_number, 45, y + 5.5);
          doc.text(c.supplier_name.length > 32 ? c.supplier_name.slice(0, 30) + '...' : c.supplier_name, 78, y + 5.5);
          
          // Status color and bold font
          const status = c.status.toLowerCase();
          doc.setFont('helvetica', 'bold');
          if (status === 'cleared') {
            doc.setTextColor(16, 124, 65); // Green
            doc.text("CLEARED", 145, y + 5.5);
          } else if (status === 'bounced') {
            doc.setTextColor(185, 28, 28); // Red
            doc.text("BOUNCED", 145, y + 5.5);
          } else if (status === 'issued') {
            doc.setTextColor(29, 78, 216); // Blue
            doc.text("ISSUED", 145, y + 5.5);
          } else {
            doc.setTextColor(217, 119, 6); // Amber
            doc.text("PENDING", 145, y + 5.5);
          }
          
          doc.setTextColor(...cDark);
          doc.setFont('helvetica', 'bold');
          doc.text(fmt(c.amount), 190, y + 5.5, { align: 'right' });

          doc.setDrawColor(243, 244, 246);
          doc.line(15, y + 8, 195, y + 8);
          y += 8;
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
