const mongoose = require('mongoose');

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

/**
 * GET /api/health
 * Public. Reports whether the API is up and whether MongoDB is connected.
 */
function getHealth(_req, res) {
  res.json({
    status: 'ok',
    service: 'resitrack-api',
    database: DB_STATES[mongoose.connection.readyState] || 'unknown',
    timestamp: new Date().toISOString(),
  });
}

module.exports = { getHealth };
