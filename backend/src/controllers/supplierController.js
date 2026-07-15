const service = require('../services/supplierService');

exports.list = (req, res, next) => {
  try { res.json(service.list({ search: req.query.search, includeInactive: req.query.include_inactive === '1' })); }
  catch (e) { next(e); }
};
exports.get = (req, res, next) => { try { res.json(service.get(+req.params.id)); } catch (e) { next(e); } };
exports.create = (req, res, next) => { try { res.status(201).json(service.create(req.body, req.user.id)); } catch (e) { next(e); } };
exports.update = (req, res, next) => { try { res.json(service.update(+req.params.id, req.body, req.user.id)); } catch (e) { next(e); } };
exports.remove = (req, res, next) => { try { res.json(service.remove(+req.params.id, req.user.id)); } catch (e) { next(e); } };
