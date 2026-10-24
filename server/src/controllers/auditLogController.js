
const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../utils/asyncHandler');

const listAuditLogs = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);

  const logs = await AuditLog.find()
    .sort({ timestamp: -1, _id: -1 })
    .limit(limit)
    .populate('actorId', 'name email role')
    .lean();

  res.json({ count: logs.length, logs });
});

module.exports = { listAuditLogs };
