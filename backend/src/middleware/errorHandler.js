// Translates thrown errors into consistent JSON responses.
const { AppError } = require('../utils/errors');

module.exports = function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) return res.status(err.status).json({ error: err.message });
  if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: 'A record with the same unique value already exists.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
};
