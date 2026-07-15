const service = require('../services/financeService');

exports.listRevenue = (req, res, next) => {
  try { res.json(service.listRevenue({ from: req.query.from, to: req.query.to })); } catch (e) { next(e); }
};
exports.recordRevenue = (req, res, next) => {
  try { res.status(201).json(service.recordRevenue(req.body, req.user.id)); } catch (e) { next(e); }
};
exports.deleteRevenue = (req, res, next) => {
  try { res.json(service.deleteRevenue(+req.params.id, req.user.id)); } catch (e) { next(e); }
};
exports.account = (req, res, next) => { try { res.json(service.account()); } catch (e) { next(e); } };
