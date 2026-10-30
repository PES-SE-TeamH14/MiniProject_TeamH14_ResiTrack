const ApiError = require('../utils/ApiError');

/**
 * NFR-04 / SEC-02 (#19): plain HTTP is never served in production.
 *
 * On a host such as Render the platform terminates TLS and forwards requests to Node over HTTP,
 * setting X-Forwarded-Proto. With `trust proxy` enabled (see app.js) Express reads that header, so
 * `req.secure` is true only when the browser really used HTTPS.
 *
 *  - GET / HEAD over HTTP are redirected (308) to the same URL on HTTPS.
 *  - Any other method over HTTP is rejected with 426 so credentials in a POST body are never accepted.
 *  - /api/health is left open because platform health checks call the service over plain HTTP.
 *    It returns no user data.
 *
 * Turned on with FORCE_HTTPS=true. Off by default, so local development on http://localhost still works.
 */
function enforceHttps(options = {}) {
  const enabled = options.enabled !== undefined ? options.enabled : process.env.FORCE_HTTPS === 'true';
  // Optional fixed host for redirects, e.g. resitrack-api.onrender.com. Falls back to the Host header.
  const fixedHost = options.host !== undefined ? options.host : process.env.HTTPS_HOST;

  return function enforceHttpsMiddleware(req, res, next) {
    if (!enabled || req.secure) return next();
    if (req.path === '/api/health' || req.path === '/api/health/') return next();

    if (req.method === 'GET' || req.method === 'HEAD') {
      const host = fixedHost || req.headers.host;
      return res.redirect(308, `https://${host}${req.originalUrl}`);
    }

    return next(new ApiError(426, 'HTTPS_REQUIRED', 'This API only accepts HTTPS requests.'));
  };
}

module.exports = enforceHttps;
