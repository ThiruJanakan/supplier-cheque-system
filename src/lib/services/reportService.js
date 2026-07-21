import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { getSetting } from './settingsService';
import { listCheques } from './chequeService';
import { listSuppliers } from './supplierService';
import { listPurchases } from './purchaseService';

function monthRange(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Month must be in YYYY-MM format.');
  // Safe date range
  return { from: `${month}-01`, to: `${month}-31` };
}

export async function monthlySummary(supabase, month) {
  const { from, to } = monthRange(month);

  // 1. Spend Total & Breakdown
  const { data: purchases, error: errP } = await supabase
    .from('purchases')
    .select(`
      total_amount,
      supplier_id,
      suppliers(name),
      allocations:cheque_allocations(
        allocated_amount,
        cheque:cheques(status)
      ),
      payments:purchase_payments(amount)
    `)
    .gte('purchase_date', from)
    .lte('purchase_date', to);

  if (errP) throw new Error(errP.message);

  let spendTotal = 0;
  let paidTotal = 0;
  let outstandingTotal = 0;

  // 2. Spend by Supplier
  const supplierSpendMap = {};
  purchases.forEach(p => {
    const sId = p.supplier_id;
    const name = p.suppliers ? p.suppliers.name : 'Unknown';
    if (!supplierSpendMap[sId]) {
      supplierSpendMap[sId] = { id: sId, name, total: 0 };
    }
    const totalAmt = Number(p.total_amount);
    supplierSpendMap[sId].total += totalAmt;

    const paid_cheques = (p.allocations || [])
      .filter(a => a.cheque && !['bounced', 'cancelled'].includes(a.cheque.status))
      .reduce((sum, a) => sum + Number(a.allocated_amount), 0);
    const paid_payments = (p.payments || []).reduce((sum, pay) => sum + Number(pay.amount), 0);
    const paid = paid_cheques + paid_payments;
    const outstanding = Number((totalAmt - paid).toFixed(2));

    spendTotal += totalAmt;
    paidTotal += paid;
    outstandingTotal += outstanding;
  });
  const spendBySupplier = Object.values(supplierSpendMap).sort((a, b) => b.total - a.total);

  // 3. Revenue Total
  const { data: revenues, error: errR } = await supabase
    .from('revenue_entries')
    .select('amount')
    .gte('entry_date', from)
    .lte('entry_date', to);

  if (errR) throw new Error(errR.message);
  const revenueTotal = revenues.reduce((sum, r) => sum + Number(r.amount), 0);

  // 4. Cheque stats
  const { data: cheques, error: errC } = await supabase
    .from('cheques')
    .select('amount, status')
    .gte('issue_date', from)
    .lte('issue_date', to);

  if (errC) throw new Error(errC.message);

  let total_issued = cheques.length;
  let pending_clearance = 0;
  let cleared = 0;
  let bounced = 0;
  let total_value = 0;

  cheques.forEach(c => {
    total_value += Number(c.amount);
    if (['issued', 'pending', 'partially_paid'].includes(c.status)) {
      pending_clearance++;
    } else if (c.status === 'cleared') {
      cleared++;
    } else if (c.status === 'bounced') {
      bounced++;
    }
  });

  const chequeStats = {
    total_issued,
    pending_clearance,
    cleared,
    bounced,
    total_value
  };

  // 5. Upcoming cheques (Pending due dates in the future)
  const today = new Date().toISOString().substring(0, 10);
  const upcomingList = await listCheques(supabase, { dueFrom: today });
  const upcoming = upcomingList
    .filter(c => ['issued', 'pending', 'partially_paid'].includes(c.status))
    .slice(0, 30);

  return { month, spendTotal, paidTotal, outstandingTotal, spendBySupplier, revenueTotal, chequeStats, upcoming };
}

export async function getTrends(supabase, months = 6) {
  const result = [];
  const now = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    result.push({ month: ym, spending: 0, revenue: 0 });
  }

  const startYm = result[0].month;
  const startDate = `${startYm}-01`;

  const { data: purchases, error: errP } = await supabase
    .from('purchases')
    .select('total_amount, purchase_date')
    .gte('purchase_date', startDate);

  if (errP) throw new Error(errP.message);

  const { data: revenues, error: errR } = await supabase
    .from('revenue_entries')
    .select('amount, entry_date')
    .gte('entry_date', startDate);

  if (errR) throw new Error(errR.message);

  purchases.forEach(p => {
    const ym = p.purchase_date.substring(0, 7);
    const item = result.find(r => r.month === ym);
    if (item) item.spending += Number(p.total_amount);
  });

  revenues.forEach(r => {
    const ym = r.entry_date.substring(0, 7);
    const item = result.find(r => r.month === ym);
    if (item) item.revenue += Number(r.amount);
  });

  return result;
}

export async function getSavingsGrowth(supabase, limit = 365) {
  const { data, error } = await supabase
    .from('savings_transactions')
    .select('balance_after, created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const daysMap = {};
  data.forEach(row => {
    const day = row.created_at.substring(0, 10);
    if (daysMap[day] === undefined) {
      daysMap[day] = Number(row.balance_after);
    }
  });

  const growth = Object.entries(daysMap)
    .map(([day, balance]) => ({ day, balance }))
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-limit);

  return growth;
}

export async function getCalendar(supabase, month) {
  const { from, to } = monthRange(month);

  const cheques = await listCheques(supabase, { dueFrom: from, dueTo: to });
  return cheques.map(c => ({
    due_date: c.due_date,
    id: c.id,
    cheque_number: c.cheque_number,
    amount: c.amount,
    status: c.status,
    supplier_name: c.supplier_name
  }));
}

export async function exportExcel(supabase, month) {
  const data = await monthlySummary(supabase, month);
  const currency = await getSetting(supabase, 'currency') || 'LKR';
  const wb = new ExcelJS.Workbook();

  const summary = wb.addWorksheet('Summary');
  summary.addRows([
    [`Monthly Report - ${month}`], [],
    ['Total supplier spending', data.spendTotal],
    ['Total sales revenue deposited', data.revenueTotal],
    ['Cheques issued', data.chequeStats.total_issued],
    ['Pending clearance', data.chequeStats.pending_clearance],
    ['Cleared', data.chequeStats.cleared],
    ['Bounced', data.chequeStats.bounced],
  ]);
  summary.getColumn(1).width = 34; 
  summary.getColumn(2).width = 18;
  summary.getCell('A1').font = { bold: true, size: 14 };

  const bySup = wb.addWorksheet('Spending by supplier');
  bySup.addRow(['Supplier', `Total (${currency})`]).font = { bold: true };
  data.spendBySupplier.forEach(r => bySup.addRow([r.name, r.total]));
  bySup.getColumn(1).width = 40; 
  bySup.getColumn(2).width = 18;

  const up = wb.addWorksheet('Upcoming cheques');
  up.addRow(['Due date', 'Cheque no', 'Supplier', `Amount (${currency})`, 'Status']).font = { bold: true };
  data.upcoming.forEach(c => up.addRow([c.due_date, c.cheque_number, c.supplier_name, c.amount, c.status]));
  [14, 16, 36, 16, 14].forEach((w, i) => up.getColumn(i + 1).width = w);

  return wb.xlsx.writeBuffer();
}

export async function exportPdf(supabase, month, stream) {
  const data = await monthlySummary(supabase, month);
  const currency = await getSetting(supabase, 'currency') || 'LKR';
  const fmt = n => `${currency} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  
  const doc = new PDFDocument({ margin: 48 });
  doc.pipe(stream);

  doc.fontSize(18).text(`Monthly Report — ${month}`, { underline: false });
  doc.moveDown(0.3).fontSize(10).fillColor('#555')
     .text(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
  doc.moveDown(1).fillColor('#000');

  doc.fontSize(13).text('Summary');
  doc.moveDown(0.4).fontSize(10);
  const lines = [
    ['Total supplier spending', fmt(data.spendTotal)],
    ['Total sales revenue deposited to savings', fmt(data.revenueTotal)],
    ['Cheques issued', String(data.chequeStats.total_issued)],
    ['Pending clearance', String(data.chequeStats.pending_clearance)],
    ['Cleared', String(data.chequeStats.cleared)],
    ['Bounced', String(data.chequeStats.bounced)],
  ];
  lines.forEach(([k, v]) => doc.text(`${k}: ${v}`));

  doc.moveDown(1).fontSize(13).text('Spending by supplier');
  doc.moveDown(0.4).fontSize(10);
  if (!data.spendBySupplier.length) doc.text('No purchases recorded this month.');
  data.spendBySupplier.forEach(r => doc.text(`${r.name} — ${fmt(r.total)}`));

  doc.moveDown(1).fontSize(13).text('Upcoming cheque due dates');
  doc.moveDown(0.4).fontSize(10);
  if (!data.upcoming.length) doc.text('No pending cheques.');
  data.upcoming.forEach(c => doc.text(`${c.due_date}  ·  #${c.cheque_number}  ·  ${c.supplier_name}  ·  ${fmt(c.amount)}  ·  ${c.status}`));

  doc.end();
}

// ============================================================
// Suppliers directory PDF (contact, bank & credit summary)
// ============================================================
export async function exportSuppliersPdf(supabase, stream) {
  const currency = await getSetting(supabase, 'currency') || 'LKR';
  const fmt = n => `${currency} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const [suppliers, purchases] = await Promise.all([
    listSuppliers(supabase, {}),
    listPurchases(supabase, {}),
  ]);

  // Aggregate purchase totals per supplier.
  const agg = {};
  for (const p of purchases) {
    const a = agg[p.supplier_id] || (agg[p.supplier_id] = { total: 0, paid: 0, outstanding: 0, openDues: 0 });
    a.total += Number(p.total_amount);
    a.paid += Number(p.paid_amount);
    a.outstanding += Number(p.outstanding);
    if (Number(p.outstanding) > 0.005) a.openDues += 1;
  }

  const grand = suppliers.reduce((acc, s) => {
    const a = agg[s.id] || {};
    acc.total += a.total || 0;
    acc.paid += a.paid || 0;
    acc.outstanding += a.outstanding || 0;
    return acc;
  }, { total: 0, paid: 0, outstanding: 0 });

  const BRAND = '#0f5132';
  const INK = '#1f2937';
  const MUTED = '#6b7280';
  const LINE = '#e5e7eb';
  const SHADE = '#f3f6f4';

  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  doc.pipe(stream);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  // ---- Title band ----
  doc.rect(0, 0, doc.page.width, 96).fill(BRAND);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20)
     .text('Supplier Directory', left, 30);
  doc.font('Helvetica').fontSize(10).fillColor('#d1e7dd')
     .text('Contact, bank details & outstanding credit', left, 58);
  doc.fontSize(9).fillColor('#d1e7dd')
     .text(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · ${suppliers.length} active suppliers`, left, 74);

  let y = 120;

  // ---- Portfolio summary strip ----
  const cards = [
    ['Total purchased', fmt(grand.total)],
    ['Total paid', fmt(grand.paid)],
    ['Total outstanding', fmt(grand.outstanding)],
  ];
  const cardW = (width - 16) / 3;
  cards.forEach(([label, value], i) => {
    const x = left + i * (cardW + 8);
    doc.roundedRect(x, y, cardW, 46, 6).fill(SHADE);
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(label.toUpperCase(), x + 10, y + 9, { width: cardW - 20 });
    doc.fillColor(i === 2 ? '#b42318' : INK).font('Helvetica-Bold').fontSize(13).text(value, x + 10, y + 22, { width: cardW - 20 });
  });
  y += 66;

  const ensureSpace = needed => {
    if (y + needed > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
    }
  };

  const label = (t, x, yy) => doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(t.toUpperCase(), x, yy);
  const value = (t, x, yy, w) => doc.fillColor(INK).font('Helvetica').fontSize(10).text(t || '—', x, yy + 10, { width: w });

  if (!suppliers.length) {
    doc.fillColor(MUTED).font('Helvetica').fontSize(11).text('No active suppliers on record.', left, y);
    doc.end();
    return;
  }

  suppliers.forEach((s, idx) => {
    const a = agg[s.id] || { total: 0, paid: 0, outstanding: 0, openDues: 0 };
    const blockH = 150;
    ensureSpace(blockH + 12);

    const top = y;
    // Card container
    doc.roundedRect(left, top, width, blockH, 8).fillAndStroke('#ffffff', LINE);

    // Header row
    doc.rect(left, top, width, 28).fill(idx % 2 === 0 ? SHADE : '#eef2f0');
    doc.roundedRect(left, top, width, blockH, 8).stroke(LINE);
    doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(12).text(s.name, left + 12, top + 8, { width: width - 160 });
    // Outstanding pill on the right of header
    const pill = a.outstanding > 0.005 ? fmt(a.outstanding) + ' due' : 'Settled';
    doc.fillColor(a.outstanding > 0.005 ? '#b42318' : BRAND).font('Helvetica-Bold').fontSize(9)
       .text(pill, right - 160, top + 9, { width: 148, align: 'right' });

    // Two-column details
    const colX1 = left + 12;
    const colX2 = left + width / 2 + 6;
    const colW = width / 2 - 24;
    let ry = top + 38;

    label('Contact', colX1, ry); value(s.contact_person, colX1, ry, colW);
    label('Bank', colX2, ry); value(s.bank_name, colX2, ry, colW);
    ry += 30;
    label('Phone', colX1, ry); value(s.phone, colX1, ry, colW);
    label('Account no', colX2, ry);
    value([s.bank_account_no, s.branch_name, s.branch_code].filter(Boolean).join(' · '), colX2, ry, colW);
    ry += 30;
    label('Email', colX1, ry); value(s.email, colX1, ry, colW);
    label('Address', colX2, ry); value(s.address, colX2, ry, colW);

    // Credit summary footer line
    const fy = top + blockH - 22;
    doc.moveTo(left + 12, fy - 6).lineTo(right - 12, fy - 6).strokeColor(LINE).stroke();
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
       .text(`Purchased ${fmt(a.total)}   ·   Paid ${fmt(a.paid)}   ·   Outstanding ${fmt(a.outstanding)}   ·   Open dues ${a.openDues}`,
             left + 12, fy, { width: width - 24 });

    y = top + blockH + 12;
  });

  doc.end();
}
