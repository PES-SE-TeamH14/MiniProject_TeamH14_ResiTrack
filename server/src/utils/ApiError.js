/**
 * An error with an HTTP status and a machine-readable code,
 * turned into the standard JSON error response by errorHandler.
 */
class ApiError extends Error {
  constructor(status, code, message, field) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (field) this.field = field;
  }
}

module.exports = ApiError;
