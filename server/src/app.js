const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const routes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security headers and CORS (only the React client may call the API in development)
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Request logging (skipped while running tests)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// All API routes are prefixed with /api (SAD §3.2)
app.use('/api', routes);

// Unknown routes, then the central error handler (SAD §3.3)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
