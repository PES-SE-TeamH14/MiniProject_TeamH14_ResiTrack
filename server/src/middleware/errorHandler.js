const ApiError = require('../utils/ApiError');

/**
 * Central error handler. Every error leaves the API in one JSON shape (SAD §3.3):
 *   { "error": { "code": "...", "message": "...", "field": "..." } }
 */
// Express recognises error handlers by their four arguments, so `_next` must stay.
function errorHandler(err, _req, res, _next) {
  let status = 500;
  let body = { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' };

  if (err instanceof ApiError) {
    status = err.status;
    body = { code: err.code, message: err.message };
    if (err.field) body.field = err.field;
  } else if (err.type === 'entity.parse.failed') {
    // Malformed JSON in the request body
    status = 400;
    body = { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' };
  } else if (err.name === 'ValidationError' && err.errors) {
    // Mongoose schema validation
    const field = Object.keys(err.errors)[0];
    status = 400;
    body = { code: 'VALIDATION_ERROR', message: err.errors[field].message, field };
  } else if (err.name === 'CastError') {
    // Invalid ObjectId in a URL parameter
    status = 404;
    body = { code: 'NOT_FOUND', message: 'Resource not found.' };
  } else if (err.code === 11000) {
    // Unique index violation, e.g. an email that is already registered
    const field = Object.keys(err.keyValue || {})[0];
    status = 409;
    body = { code: 'DUPLICATE', message: `${field || 'Value'} already exists.` };
    if (field) body.field = field;
  }

  // Full details stay in the server log only; clients get a generic message for 500s
  if (status === 500 && process.env.NODE_ENV !== 'test') {
    console.error(err);
  }

  res.status(status).json({ error: body });
}

module.exports = errorHandler;
