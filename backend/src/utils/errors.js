// Domain error with HTTP status, thrown from services and translated by middleware.
class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
module.exports = { AppError };
