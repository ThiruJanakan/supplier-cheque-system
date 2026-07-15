const service = require('../services/chequeService');

exports.list = (req, res, next) => {
  try {
    res.json(service.list({
      status: req.query.status, search: req.query.search,
      supplierId: req.query.supplier_id ? +req.query.supplier_id : undefined,
      dueFrom: req.query.due_from, dueTo: req.query.due_to,
    }));
  } catch (e) { next(e); }
};
exports.get = (req, res, next) => { try { res.json(service.get(+req.params.id)); } catch (e) { next(e); } };
exports.create = (req, res, next) => { try { res.status(201).json(service.create(req.body, req.user.id)); } catch (e) { next(e); } };
exports.update = (req, res, next) => { try { res.json(service.update(+req.params.id, req.body, req.user.id)); } catch (e) { next(e); } };
exports.setStatus = async (req, res, next) => {
  try { res.json(await service.setStatus(+req.params.id, req.body.status, req.user.id)); } catch (e) { next(e); }
};
exports.remove = (req, res, next) => { try { res.json(service.remove(+req.params.id, req.user.id)); } catch (e) { next(e); } };
