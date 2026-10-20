
const ApiError = require('../utils/ApiError');

const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Reject authenticated requests when the token's last activity is older
 * than the configured idle timeout.
 *
 * The authentication middleware must set req.auth.lastActivityAt from
 * a trusted source before this middleware runs.
 */
function createSessionTimeout({
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  now = Date.now,
} = {}) {
  if (!Number.isFinite(idleTimeoutMs) || idleTimeoutMs <= 0) {
    throw new TypeError('idleTimeoutMs must be a positive number.');
  }

  return function sessionTimeout(req, _res, next) {
    const lastActivityAt = req.auth?.lastActivityAt;

    // Leave unauthenticated requests to the authentication middleware.
    if (lastActivityAt === undefined || lastActivityAt === null) {
      return next();
    }

    const lastActivityTime = new Date(lastActivityAt).getTime();

    if (
      !Number.isFinite(lastActivityTime) ||
      now() - lastActivityTime >= idleTimeoutMs
    ) {
      return next(
        new ApiError(
          401,
          'SESSION_EXPIRED',
          'Your session expired due to inactivity. Please log in again.',
        ),
      );
    }

    return next();
  };
}

module.exports = {
  createSessionTimeout,
  DEFAULT_IDLE_TIMEOUT_MS,
};
