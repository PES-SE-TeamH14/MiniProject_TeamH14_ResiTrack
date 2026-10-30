const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const routes = require('./routes');
const enforceHttps = require('./middleware/enforceHttps');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Behind a hosting proxy (Render, Railway) TLS ends at the proxy. TRUST_PROXY=1 makes Express read
// X-Forwarded-Proto, so req.secure is correct. Leave it unset when running directly (local development).
if (process.env.TRUST_PROXY) {
  const hops = Number(process.env.TRUST_PROXY);
  app.set('trust proxy', Number.isNaN(hops) ? process.env.TRUST_PROXY : hops);
}

// NFR-04 / SEC-02 (#19): reject or redirect plain HTTP when FORCE_HTTPS=true (production)
app.use(enforceHttps());

// Security headers (including Strict-Transport-Security, so browsers keep using HTTPS) and CORS
// (only the React client may call the API in development)
app.use(
  helmet({
    strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
  }),
);
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    // Let the React client read the refreshed login token (sliding session, NFR-05)
    exposedHeaders: ['X-Auth-Token'],
  }),
);

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Request logging (skipped while running tests, and during the load test: REQUEST_LOGS=off)
if (process.env.NODE_ENV !== 'test' && process.env.REQUEST_LOGS !== 'off') {
  app.use(morgan('dev'));
}

// All API routes are prefixed with /api (SAD §3.2)
app.use('/api', routes);

// Unknown routes, then the central error handler (SAD §3.3)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
