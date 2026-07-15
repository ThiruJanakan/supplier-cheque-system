const service = require('../services/reportService');

const month = req => req.query.month || new Date().toISOString().slice(0, 7);

exports.monthly = (req, res, next) => { try { res.json(service.monthlySummary(month(req))); } catch (e) { next(e); } };
exports.trends = (req, res, next) => { try { res.json(service.trends(+(req.query.months || 6))); } catch (e) { next(e); } };
exports.savingsGrowth = (req, res, next) => { try { res.json(service.savingsGrowth()); } catch (e) { next(e); } };
exports.calendar = (req, res, next) => { try { res.json(service.calendar(month(req))); } catch (e) { next(e); } };

exports.exportExcel = async (req, res, next) => {
  try {
    const buffer = await service.exportExcel(month(req));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="report-${month(req)}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (e) { next(e); }
};
exports.exportPdf = (req, res, next) => {
  try {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${month(req)}.pdf"`);
    service.exportPdf(month(req), res);
  } catch (e) { next(e); }
};
