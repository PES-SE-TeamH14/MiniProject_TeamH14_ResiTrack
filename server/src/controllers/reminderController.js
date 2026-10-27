const Reminder = require('../models/Reminder');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { recordAuditLog } = require('../utils/auditLogger');
const { sendDueReminders } = require('../services/reminderService');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Reads an optional YYYY-MM-DD "date" and rejects dates that do not exist (e.g. 2026-02-30). */
function parseDate(value) {
  if (value === undefined || value === '') return new Date();
  const date = typeof value === 'string' && DATE_PATTERN.test(value) ? new Date(`${value}T00:00:00.000Z`) : null;
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Date must be a real date in YYYY-MM-DD format.', 'date');
  }
  return date;
}

/**
 * POST /api/reminders/run — Admin. Sends the reminders that are due now (FR-07, UC-07).
 * This is the same job the daily schedule runs. Optional body { date: "YYYY-MM-DD" } runs it as if
 * that were today, which is handy for a demo.
 */
const runReminders = asyncHandler(async (req, res) => {
  const now = parseDate(req.body?.date);
  const summary = await sendDueReminders({ now });

  await recordAuditLog({
    actorId: req.user._id,
    action: 'REMINDERS_RUN',
    resourceType: 'Reminder',
    metadata: { upcoming: summary.upcoming, overdue: summary.overdue, failed: summary.failed },
  });

  res.json({ summary });
});

/**
 * GET /api/reminders?month=YYYY-MM&status=sent — Admin. Reminders sent so far, newest first (max 200).
 */
const listReminders = asyncHandler(async (req, res) => {
  const { month, status } = req.query;
  const filter = {};
  if (month !== undefined) {
    if (typeof month !== 'string' || !MONTH_PATTERN.test(month)) {
      throw new ApiError(400, 'INVALID_QUERY', 'month must be in YYYY-MM format.', 'month');
    }
    filter.month = month;
  }
  if (status !== undefined) {
    if (!Reminder.STATUSES.includes(status)) {
      throw new ApiError(400, 'INVALID_QUERY', `status must be one of: ${Reminder.STATUSES.join(', ')}.`, 'status');
    }
    filter.status = status;
  }

  const reminders = await Reminder.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('tenant', 'name email')
    .populate('flat', 'flatNumber block')
    .lean();
  res.json({ count: reminders.length, reminders });
});

module.exports = { runReminders, listReminders };
