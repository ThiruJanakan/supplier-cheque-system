const authService = require('../services/authService');

exports.login = (req, res, next) => {
  try { res.json(authService.login(req.body.username, req.body.password)); }
  catch (e) { next(e); }
};
exports.changePassword = (req, res, next) => {
  try {
    authService.changePassword(req.user.id, req.body.current_password, req.body.new_password);
    res.json({ ok: true });
  } catch (e) { next(e); }
};
exports.me = (req, res) => res.json(req.user);
