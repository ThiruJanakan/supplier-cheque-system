// Verifies the JWT and attaches the admin user to the request.
const jwt = require('jsonwebtoken');
const env = require('../config/env');

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = { id: payload.sub, username: payload.username, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
};
