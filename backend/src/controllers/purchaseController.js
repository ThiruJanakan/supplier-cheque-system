const service = require('../services/purchaseService');

exports.list = (req, res, next) => {
  try {
    res.json(service.list({
      supplierId: req.query.supplier_id ? +req.query.supplier_id : undefined,
      from: req.query.from, to: req.query.to, search: req.query.search,
    }));
  } catch (e) { next(e); }
};
exports.get = (req, res, next) => { try { res.json(service.get(+req.params.id)); } catch (e) { next(e); } };
exports.create = (req, res, next) => { try { res.status(201).json(service.create(req.body, req.user.id)); } catch (e) { next(e); } };
exports.update = (req, res, next) => { try { res.json(service.update(+req.params.id, req.body, req.user.id)); } catch (e) { next(e); } };
exports.remove = (req, res, next) => { try { res.json(service.remove(+req.params.id, req.user.id)); } catch (e) { next(e); } };
