// Business layer: monthly summaries, trends, calendar data, and file exports.
const { db } = require('../config/database');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const settingsRepo = require('../repositories/settingsRepository');

function monthRange(month) {
  // month = 'YYYY-MM'
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('month must be YYYY-MM');
  return { from: `${month}-01`, to: `${month}-31` };
}

function monthlySummary(month) {
  const { from, to } = monthRange(month);
  const spendTotal = db.prepare('SELECT IFNULL(SUM(total_amount),0) t FROM purchases WHERE purchase_date BETWEEN ? AND ?').get(from, to).t;
  const spendBySupplier = db.prepare(`
    SELECT s.id, s.name, IFNULL(SUM(p.total_amount),0) AS total
    FROM purchases p JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.purchase_date BETWEEN ? AND ?
    GROUP BY s.id ORDER BY total DESC`).all(from, to);
  const revenueTotal = db.prepare('SELECT IFNULL(SUM(amount),0) t FROM revenue_entries WHERE entry_date BETWEEN ? AND ?').get(from, to).t;
  const chequeStats = db.prepare(`
    SELECT
      COUNT(*) AS total_issued,
      SUM(CASE WHEN status IN ('issued','pending','partially_paid') THEN 1 ELSE 0 END) AS pending_clearance,
      SUM(CASE WHEN status = 'cleared' THEN 1 ELSE 0 END) AS cleared,
      SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END) AS bounced,
      IFNULL(SUM(amount),0) AS total_value
    FROM cheques WHERE issue_date BETWEEN ? AND ?`).get(from, to);
  const upcoming = db.prepare(`
    SELECT c.id, c.cheque_number, c.amount, c.due_date, c.status, s.name AS supplier_name
    FROM cheques c JOIN suppliers s ON s.id = c.supplier_id
    WHERE c.status IN ('issued','pending','partially_paid') AND c.due_date >= date('now')
    ORDER BY c.due_date LIMIT 30`).all();
  return { month, spendTotal, spendBySupplier, revenueTotal, chequeStats, upcoming };
}

function trends(months = 6) {
  return db.prepare(`
    WITH RECURSIVE m(n, ym) AS (
      SELECT 0, strftime('%Y-%m', 'now')
      UNION ALL SELECT n+1, strftime('%Y-%m', 'now', '-' || (n+1) || ' months') FROM m WHERE n < ?
    )
    SELECT ym AS month,
      IFNULL((SELECT SUM(total_amount) FROM purchases WHERE strftime('%Y-%m', purchase_date)=ym),0) AS spending,
      IFNULL((SELECT SUM(amount) FROM revenue_entries WHERE strftime('%Y-%m', entry_date)=ym),0) AS revenue
    FROM m ORDER BY ym`).all(months - 1);
}

function savingsGrowth(limit = 365) {
  return db.prepare(`SELECT date(created_at) AS day, MAX(balance_after) AS balance
    FROM savings_transactions GROUP BY day ORDER BY day DESC LIMIT ?`).all(limit).reverse();
}

function calendar(month) {
  const { from, to } = monthRange(month);
  return db.prepare(`
    SELECT c.due_date, c.id, c.cheque_number, c.amount, c.status, s.name AS supplier_name
    FROM cheques c JOIN suppliers s ON s.id = c.supplier_id
    WHERE c.due_date BETWEEN ? AND ? ORDER BY c.due_date`).all(from, to);
}

// ---- Exports ---------------------------------------------------------------
async function exportExcel(month) {
  const data = monthlySummary(month);
  const currency = settingsRepo.get('currency') || 'LKR';
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
  summary.getColumn(1).width = 34; summary.getColumn(2).width = 18;
  summary.getCell('A1').font = { bold: true, size: 14 };

  const bySup = wb.addWorksheet('Spending by supplier');
  bySup.addRow(['Supplier', `Total (${currency})`]).font = { bold: true };
  data.spendBySupplier.forEach(r => bySup.addRow([r.name, r.total]));
  bySup.getColumn(1).width = 40; bySup.getColumn(2).width = 18;

  const up = wb.addWorksheet('Upcoming cheques');
  up.addRow(['Due date', 'Cheque no', 'Supplier', `Amount (${currency})`, 'Status']).font = { bold: true };
  data.upcoming.forEach(c => up.addRow([c.due_date, c.cheque_number, c.supplier_name, c.amount, c.status]));
  [14, 16, 36, 16, 14].forEach((w, i) => up.getColumn(i + 1).width = w);

  return wb.xlsx.writeBuffer();
}

function exportPdf(month, stream) {
  const data = monthlySummary(month);
  const currency = settingsRepo.get('currency') || 'LKR';
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

module.exports = { monthlySummary, trends, savingsGrowth, calendar, exportExcel, exportPdf };
