// Lightweight input validation helpers used by services.
const { AppError } = require('./errors');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function requireFields(obj, fields) {
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null || obj[f] === '') {
      throw new AppError(`Field "${f}" is required.`);
    }
  }
}
function validDate(value, label) {
  if (!ISO_DATE.test(value) || isNaN(Date.parse(value))) {
    throw new AppError(`${label} must be a valid date (YYYY-MM-DD).`);
  }
}
function positiveNumber(value, label) {
  const n = Number(value);
  if (!isFinite(n) || n <= 0) throw new AppError(`${label} must be a positive number.`);
  return n;
}
module.exports = { requireFields, validDate, positiveNumber };
