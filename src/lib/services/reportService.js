import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { getSetting } from './settingsService';
import { listCheques } from './chequeService';

function monthRange(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Month must be in YYYY-MM format.');
  // Safe date range
  return { from: `${month}-01`, to: `${month}-31` };
}

export async function monthlySummary(supabase, month) {
  const { from, to } = monthRange(month);

  // 1. Spend Total
  const { data: purchases, error: errP } = await supabase
    .from('purchases')
    .select('total_amount, supplier_id, suppliers(name)')
    .gte('purchase_date', from)
    .lte('purchase_date', to);

  if (errP) throw new Error(errP.message);

  const spendTotal = purchases.reduce((sum, p) => sum + Number(p.total_amount), 0);

  // 2. Spend by Supplier
  const supplierSpendMap = {};
  purchases.forEach(p => {
    const sId = p.supplier_id;
    const name = p.suppliers ? p.suppliers.name : 'Unknown';
    if (!supplierSpendMap[sId]) {
      supplierSpendMap[sId] = { id: sId, name, total: 0 };
    }
    supplierSpendMap[sId].total += Number(p.total_amount);
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

  return { month, spendTotal, spendBySupplier, revenueTotal, chequeStats, upcoming };
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
