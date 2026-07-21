import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { getSetting } from './settingsService';
import { listCheques } from './chequeService';
import { listSuppliers, monthBounds } from './supplierService';
import { listPurchases, listCreditDues } from './purchaseService';
import { listRevenue, getBalance } from './financeService';

// Delegates to monthBounds so short months get a real last day
// (a hardcoded "-31" breaks Postgres date casts for e.g. June).
function monthRange(month) {
  return monthBounds(month);
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

// ============================================================
// Excel styling helpers (shared by all workbook exports)
// ============================================================
const XL = {
  brand: 'FF185C45',   // banker green
  ink: 'FF1F2937',
  muted: 'FF6B7280',
  shade: 'FFF3F6F4',   // zebra stripe
  red: 'FFB42318',
  green: 'FF107C41',
  money: '#,##0.00',
};
const xlThin = { style: 'thin', color: { argb: 'FFE5E7EB' } };
const xlBox = { top: xlThin, left: xlThin, bottom: xlThin, right: xlThin };
const xlFill = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

function xlMonthName(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Green title banner + generated-on subtitle across `cols` columns.
function xlTitle(ws, title, subtitle, cols) {
  ws.mergeCells(1, 1, 1, cols);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
  t.fill = xlFill(XL.brand);
  t.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, cols);
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  s.font = { size: 9, italic: true, color: { argb: XL.muted } };
  s.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(2).height = 16;
  ws.addRow([]);
}

// Bold white-on-green column header row.
function xlHeader(ws, labels) {
  const row = ws.addRow(labels);
  for (let i = 1; i <= labels.length; i++) {
    const c = row.getCell(i);
    c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.fill = xlFill(XL.brand);
    c.border = xlBox;
    c.alignment = { vertical: 'middle', wrapText: true };
  }
  row.height = 20;
  ws.views = [{ state: 'frozen', ySplit: row.number }];
  return row;
}

// Bordered data row with zebra striping.
function xlRow(ws, values, idx) {
  const row = ws.addRow(values);
  for (let i = 1; i <= values.length; i++) {
    const c = row.getCell(i);
    c.border = xlBox;
    if (idx % 2 === 1) c.fill = xlFill(XL.shade);
  }
  return row;
}

// Bold totals row with a heavier top border.
function xlTotal(ws, values) {
  const row = ws.addRow(values);
  for (let i = 1; i <= values.length; i++) {
    const c = row.getCell(i);
    c.font = { bold: true, color: { argb: XL.ink } };
    c.border = { ...xlBox, top: { style: 'medium', color: { argb: XL.brand } } };
    c.fill = xlFill(XL.shade);
  }
  return row;
}

// Section sub-heading inside the Summary sheet.
function xlSection(ws, text) {
  ws.addRow([]);
  const row = ws.addRow([text.toUpperCase()]);
  row.getCell(1).font = { bold: true, size: 10, color: { argb: XL.brand } };
  row.getCell(1).border = { bottom: { style: 'medium', color: { argb: XL.brand } } };
  row.getCell(2).border = { bottom: { style: 'medium', color: { argb: XL.brand } } };
}

// Label / value pair on the Summary sheet.
function xlKpi(ws, label, value, { numFmt, color } = {}) {
  const row = ws.addRow([label, value]);
  row.getCell(1).font = { size: 10, color: { argb: XL.muted } };
  const v = row.getCell(2);
  v.font = { bold: true, size: 10, color: { argb: color || XL.ink } };
  v.alignment = { horizontal: 'right' };
  if (numFmt) v.numFmt = numFmt;
  return row;
}

export async function exportExcel(supabase, month) {
  const data = await monthlySummary(supabase, month);
  const [trends, currencySetting, balance, dues] = await Promise.all([
    getTrends(supabase, 6),
    getSetting(supabase, 'currency'),
    getBalance(supabase),
    listCreditDues(supabase, {}),
  ]);
  const currency = currencySetting || 'LKR';
  const monthName = xlMonthName(month);
  const generated = `Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · All amounts in ${currency}`;
  const cs = data.chequeStats;
  const net = data.revenueTotal - data.spendTotal;
  const upcomingValue = data.upcoming.reduce((s, c) => s + Number(c.amount), 0);
  const topSupplier = data.spendBySupplier[0];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Cheque Manager';

  // ---- Summary sheet ----
  const summary = wb.addWorksheet('Summary');
  summary.getColumn(1).width = 44;
  summary.getColumn(2).width = 22;
  summary.getColumn(3).width = 30;
  xlTitle(summary, `Monthly Performance Report — ${monthName}`, generated, 3);

  xlSection(summary, 'Cash flow');
  xlKpi(summary, 'Total supplier spending', data.spendTotal, { numFmt: XL.money });
  xlKpi(summary, 'Total sales revenue deposited', data.revenueTotal, { numFmt: XL.money });
  xlKpi(summary, 'Net cash flow (revenue − spending)', net, { numFmt: XL.money, color: net < 0 ? XL.red : XL.green });

  xlSection(summary, 'Cheques issued this month');
  xlKpi(summary, 'Cheques issued', cs.total_issued);
  xlKpi(summary, 'Total value issued', cs.total_value, { numFmt: XL.money });
  xlKpi(summary, 'Pending clearance', cs.pending_clearance, { color: cs.pending_clearance > 0 ? XL.red : XL.green });
  xlKpi(summary, 'Cleared', cs.cleared, { color: XL.green });
  xlKpi(summary, 'Bounced', cs.bounced, { color: cs.bounced > 0 ? XL.red : XL.ink });

  xlSection(summary, 'Position today');
  xlKpi(summary, 'Savings account balance', balance, { numFmt: XL.money });
  xlKpi(summary, 'Cheques awaiting clearance (value)', upcomingValue, { numFmt: XL.money });
  xlKpi(summary, 'Balance after pending cheques clear', balance - upcomingValue,
    { numFmt: XL.money, color: balance - upcomingValue < 0 ? XL.red : XL.green });
  xlKpi(summary, 'Outstanding credit dues to suppliers', dues.grand.outstanding,
    { numFmt: XL.money, color: dues.grand.outstanding > 0 ? XL.red : XL.green });

  xlSection(summary, 'Insights');
  const insights = [];
  insights.push(net >= 0
    ? `Revenue covered spending with ${currency} ${net.toLocaleString('en-US', { minimumFractionDigits: 2 })} to spare.`
    : `Spending exceeded revenue by ${currency} ${(-net).toLocaleString('en-US', { minimumFractionDigits: 2 })} — review supplier costs.`);
  if (topSupplier && data.spendTotal > 0) {
    const share = topSupplier.total / data.spendTotal;
    insights.push(`Top supplier "${topSupplier.name}" accounts for ${(share * 100).toFixed(1)}% of this month's spending${share > 0.5 ? ' — high concentration risk.' : '.'}`);
  }
  if (cs.total_issued > 0 && cs.bounced > 0) {
    insights.push(`${cs.bounced} of ${cs.total_issued} cheques bounced (${((cs.bounced / cs.total_issued) * 100).toFixed(1)}%) — check savings cover before issuing.`);
  }
  if (balance - upcomingValue < 0) {
    insights.push(`Savings balance cannot cover all pending cheques — shortfall of ${currency} ${(upcomingValue - balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}.`);
  }
  insights.push(`${data.upcoming.length} cheques worth ${currency} ${upcomingValue.toLocaleString('en-US', { minimumFractionDigits: 2 })} are pending clearance.`);
  insights.forEach(text => {
    const row = summary.addRow([`•  ${text}`]);
    summary.mergeCells(row.number, 1, row.number, 3);
    row.getCell(1).font = { size: 10, color: { argb: XL.ink } };
    row.getCell(1).alignment = { wrapText: true, vertical: 'top' };
  });

  // ---- Spending by supplier ----
  const bySup = wb.addWorksheet('Spending by supplier');
  [42, 20, 14].forEach((w, i) => bySup.getColumn(i + 1).width = w);
  xlTitle(bySup, `Spending by Supplier — ${monthName}`, generated, 3);
  xlHeader(bySup, ['Supplier', `Total (${currency})`, 'Share of spend']);
  data.spendBySupplier.forEach((r, i) => {
    const row = xlRow(bySup, [r.name, r.total, data.spendTotal ? r.total / data.spendTotal : 0], i);
    row.getCell(2).numFmt = XL.money;
    row.getCell(3).numFmt = '0.0%';
  });
  if (!data.spendBySupplier.length) xlRow(bySup, ['No purchases recorded this month.', '', ''], 0);
  else {
    const t = xlTotal(bySup, ['Total', data.spendTotal, 1]);
    t.getCell(2).numFmt = XL.money;
    t.getCell(3).numFmt = '0.0%';
  }

  // ---- Upcoming cheques ----
  const up = wb.addWorksheet('Upcoming cheques');
  [14, 18, 36, 18, 16, 12].forEach((w, i) => up.getColumn(i + 1).width = w);
  xlTitle(up, 'Upcoming Cheque Due Dates', generated, 6);
  xlHeader(up, ['Due date', 'Cheque no', 'Supplier', `Amount (${currency})`, 'Status', 'Days to due']);
  const todayStr = new Date().toISOString().slice(0, 10);
  data.upcoming.forEach((c, i) => {
    const days = Math.round((new Date(`${c.due_date}T00:00:00Z`) - new Date(`${todayStr}T00:00:00Z`)) / 86400000);
    const row = xlRow(up, [c.due_date, c.cheque_number, c.supplier_name, Number(c.amount), c.status.replace('_', ' '), days], i);
    row.getCell(4).numFmt = XL.money;
    if (days < 0) row.getCell(6).font = { bold: true, color: { argb: XL.red } };
    else if (days <= 3) row.getCell(6).font = { bold: true, color: { argb: 'FFD97706' } };
  });
  if (!data.upcoming.length) xlRow(up, ['No pending cheques.', '', '', '', '', ''], 0);
  else {
    const t = xlTotal(up, ['Total', '', '', upcomingValue, '', '']);
    t.getCell(4).numFmt = XL.money;
  }

  // ---- 6-month trend ----
  const tr = wb.addWorksheet('6-month trend');
  [12, 20, 20, 20].forEach((w, i) => tr.getColumn(i + 1).width = w);
  xlTitle(tr, 'Spending vs Revenue — Last 6 Months', generated, 4);
  xlHeader(tr, ['Month', `Spending (${currency})`, `Revenue (${currency})`, `Net (${currency})`]);
  trends.forEach((r, i) => {
    const rowNet = r.revenue - r.spending;
    const row = xlRow(tr, [r.month, r.spending, r.revenue, rowNet], i);
    [2, 3, 4].forEach(n => row.getCell(n).numFmt = XL.money);
    row.getCell(4).font = { bold: true, color: { argb: rowNet < 0 ? XL.red : XL.green } };
    if (r.month === month) row.getCell(1).font = { bold: true, color: { argb: XL.brand } };
  });

  return wb.xlsx.writeBuffer();
}

// ============================================================
// Sales & revenue workbook for one month
// ============================================================
export async function exportRevenueExcel(supabase, month) {
  const { from, to } = monthBounds(month);
  const [entriesDesc, currencySetting, balance] = await Promise.all([
    listRevenue(supabase, { from, to }),
    getSetting(supabase, 'currency'),
    getBalance(supabase),
  ]);
  const currency = currencySetting || 'LKR';
  const entries = [...entriesDesc].reverse(); // chronological for reading
  const monthName = xlMonthName(month);
  const generated = `Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · All amounts in ${currency}`;

  const { data: ledger, error: errL } = await supabase
    .from('savings_transactions')
    .select('*')
    .gte('created_at', `${from}T00:00:00`)
    .lte('created_at', `${to}T23:59:59.999`)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (errL) throw new Error(errL.message);

  const totalRevenue = entries.reduce((s, e) => s + Number(e.amount), 0);
  const byDay = {};
  entries.forEach(e => { byDay[e.entry_date] = (byDay[e.entry_date] || 0) + Number(e.amount); });
  const days = Object.entries(byDay).sort((a, b) => b[1] - a[1]);
  const bestDay = days[0];
  const worstDay = days[days.length - 1];
  const daysInMonth = Number(to.slice(-2));
  const deposits = ledger.filter(t => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const withdrawals = ledger.filter(t => Number(t.amount) < 0).reduce((s, t) => s - Number(t.amount), 0);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Cheque Manager';

  // ---- Summary ----
  const summary = wb.addWorksheet('Summary');
  summary.getColumn(1).width = 44;
  summary.getColumn(2).width = 22;
  summary.getColumn(3).width = 30;
  xlTitle(summary, `Sales & Revenue Report — ${monthName}`, generated, 3);

  xlSection(summary, 'Sales revenue');
  xlKpi(summary, 'Total revenue deposited', totalRevenue, { numFmt: XL.money });
  xlKpi(summary, 'Entries recorded', entries.length);
  xlKpi(summary, `Days with sales (of ${daysInMonth})`, days.length);
  xlKpi(summary, 'Average per sales day', days.length ? totalRevenue / days.length : 0, { numFmt: XL.money });
  if (bestDay) xlKpi(summary, `Best day (${bestDay[0]})`, bestDay[1], { numFmt: XL.money, color: XL.green });
  if (worstDay && days.length > 1) xlKpi(summary, `Slowest day (${worstDay[0]})`, worstDay[1], { numFmt: XL.money });

  xlSection(summary, 'Savings account movement this month');
  xlKpi(summary, 'Deposits into savings', deposits, { numFmt: XL.money, color: XL.green });
  xlKpi(summary, 'Withdrawals (cheque clearances etc.)', withdrawals, { numFmt: XL.money, color: withdrawals > 0 ? XL.red : XL.ink });
  xlKpi(summary, 'Net movement', deposits - withdrawals, { numFmt: XL.money, color: deposits - withdrawals < 0 ? XL.red : XL.green });
  xlKpi(summary, 'Current balance (today)', balance, { numFmt: XL.money });

  // ---- Revenue entries ----
  const es = wb.addWorksheet('Revenue entries');
  [14, 20, 50].forEach((w, i) => es.getColumn(i + 1).width = w);
  xlTitle(es, `Revenue Entries — ${monthName}`, generated, 3);
  xlHeader(es, ['Date', `Amount (${currency})`, 'Notes']);
  entries.forEach((e, i) => {
    const row = xlRow(es, [e.entry_date, Number(e.amount), e.notes || ''], i);
    row.getCell(2).numFmt = XL.money;
  });
  if (!entries.length) xlRow(es, ['No revenue recorded this month.', '', ''], 0);
  else {
    const t = xlTotal(es, ['Total', totalRevenue, '']);
    t.getCell(2).numFmt = XL.money;
  }

  // ---- Savings ledger ----
  const ls = wb.addWorksheet('Savings ledger');
  [20, 18, 34, 18, 18].forEach((w, i) => ls.getColumn(i + 1).width = w);
  xlTitle(ls, `Savings Ledger — ${monthName}`, generated, 5);
  xlHeader(ls, ['When', 'Type', 'Reference', `Amount (${currency})`, `Balance after (${currency})`]);
  ledger.forEach((t, i) => {
    const row = xlRow(ls, [
      String(t.created_at).slice(0, 16).replace('T', ' '),
      String(t.type).replace(/_/g, ' '),
      t.reference || '',
      Number(t.amount),
      Number(t.balance_after),
    ], i);
    row.getCell(4).numFmt = XL.money;
    row.getCell(5).numFmt = XL.money;
    if (Number(t.amount) < 0) row.getCell(4).font = { color: { argb: XL.red } };
  });
  if (!ledger.length) xlRow(ls, ['No savings activity this month.', '', '', '', ''], 0);

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
export async function exportSuppliersPdf(supabase, stream, month = '') {
  const currency = await getSetting(supabase, 'currency') || 'LKR';
  const fmt = n => `${currency} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const bounds = month ? monthBounds(month) : null;
  const [suppliers, purchases] = await Promise.all([
    listSuppliers(supabase, { month }),
    listPurchases(supabase, bounds ? { from: bounds.from, to: bounds.to } : {}),
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
     .text(`Contact, bank details & outstanding credit${month ? ` — ${month}` : ''}`, left, 58);
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
