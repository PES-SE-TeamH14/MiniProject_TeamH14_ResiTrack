const Notice = require('../models/Notice');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { recordAuditLog } = require('../utils/auditLogger');

/** POST /api/notices — admins publish a community notice. */
const createNotice = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!title) throw new ApiError(400, 'VALIDATION_ERROR', 'Notice title is required.', 'title');
  if (!message) throw new ApiError(400, 'VALIDATION_ERROR', 'Notice message is required.', 'message');
  if (title.length > 120) throw new ApiError(400, 'VALIDATION_ERROR', 'Notice title can be at most 120 characters.', 'title');
  if (message.length > 5000) throw new ApiError(400, 'VALIDATION_ERROR', 'Notice message can be at most 5000 characters.', 'message');

  const notice = await Notice.create({ title, message, publishedBy: req.user._id });
  await recordAuditLog({
    actorId: req.user._id,
    action: 'NOTICE_CREATED',
    resourceType: 'Notice',
    resourceId: notice._id,
    metadata: {},
  });
  res.status(201).json({ notice });
});

/** GET /api/notices — return active notices newest first. */
const listNotices = asyncHandler(async (_req, res) => {
  const notices = await Notice.find({ isActive: true })
    .sort({ publishedAt: -1, _id: -1 })
    .select('title message publishedAt createdAt')
    .lean();
  res.json({ count: notices.length, notices });
});

module.exports = { createNotice, listNotices };
