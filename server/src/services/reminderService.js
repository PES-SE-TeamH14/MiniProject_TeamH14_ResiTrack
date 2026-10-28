const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const Reminder = require('../models/Reminder');
const { notify: defaultNotify } = require('./notifier');

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DUE_DAY = 5;
const DEFAULT_DAYS_BEFORE = 3;
const STALE_PENDING_MS = 10 * 60 * 1000;

/**
 * Reminder settings from the environment, with safe fallbacks.
 *   RENT_DUE_DAY          day of the month rent is due, 1-28 (default 5)
 *   REMINDER_DAYS_BEFORE  how many days before the due date reminders start, at least 3 (default 3, FR-07)
 */
function getConfig() {
  const dueDay = Number(process.env.RENT_DUE_DAY);
  const daysBefore = Number(process.env.REMINDER_DAYS_BEFORE);
  return {
    dueDay: Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 28 ? dueDay : DEFAULT_DUE_DAY,
    daysBefore: Number.isInteger(daysBefore) && daysBefore >= 3 ? daysBefore : DEFAULT_DAYS_BEFORE,
  };
}

const pad = (n) => String(n).padStart(2, '0');
const formatDate = (d) =>
  d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

function buildMessage(type, tenant, month, dueDate) {
  const flat = tenant.flat?.flatNumber ? `flat ${tenant.flat.flatNumber}` : 'your flat';
  const rent = tenant.flat?.monthlyRent ? ` of Rs. ${tenant.flat.monthlyRent}` : '';
  if (type === 'UPCOMING') {
    return `Hello ${tenant.name}, your rent${rent} for ${flat} (${month}) is due on ${formatDate(dueDate)}. Please pay on time.`;
  }
  return `Hello ${tenant.name}, your rent${rent} for ${flat} (${month}) was due on ${formatDate(dueDate)} and is still unpaid. Please pay as soon as possible.`;
}

/**
 * Creates the reminder record before sending. Returns null if this reminder was already sent
 * (or another worker is sending it right now); a reminder that failed earlier, or got stuck, is claimed again to retry.
 */
async function claimReminder(fields) {
  try {
    return await Reminder.create({ ...fields, status: 'pending' });
  } catch (err) {
    if (err.code !== 11000) throw err;
    const { tenant, month, type } = fields;
    const staleBefore = new Date(Date.now() - STALE_PENDING_MS);
    return Reminder.findOneAndUpdate(
      {
        tenant,
        month,
        type,
        // failed earlier, or "pending" for so long that the process sending it must have stopped
        $or: [{ status: 'failed' }, { status: 'pending', updatedAt: { $lt: staleBefore } }],
      },
      { status: 'pending', error: '', message: fields.message },
      { new: true },
    );
  }
}

/**
 * Sends rent reminders (FR-07, UC-07).
 *
 * For the previous, current and next rent month it looks at every active tenant whose lease covers that
 * month and who has no payment recorded:
 *   - UPCOMING: from `daysBefore` days before the due date up to the due date (so the daily job sends it
 *     3 days ahead of the due date)
 *   - OVERDUE:  after the due date
 * Each reminder is sent once per tenant and month. Dates are calendar days in UTC.
 *
 * @param {object}   [options]
 * @param {Date}     [options.now]     "today" (defaults to the current time; tests and demos pass a date)
 * @param {Function} [options.notify]  delivery function, defaults to the notifier
 */
async function sendDueReminders({ now = new Date(), notify = defaultNotify } = {}) {
  const { dueDay, daysBefore } = getConfig();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth();

  const summary = {
    date: new Date(today).toISOString().slice(0, 10),
    upcoming: 0,
    overdue: 0,
    failed: 0,
    alreadySent: 0,
  };

  for (const offset of [-1, 0, 1]) {
    const monthStart = new Date(Date.UTC(year, monthIndex + offset, 1));
    const dueDate = new Date(Date.UTC(year, monthIndex + offset, dueDay));
    const month = `${monthStart.getUTCFullYear()}-${pad(monthStart.getUTCMonth() + 1)}`;

    const daysUntilDue = Math.round((dueDate.getTime() - today) / DAY_MS);
    let type = null;
    if (daysUntilDue < 0) type = 'OVERDUE';
    else if (daysUntilDue <= daysBefore) type = 'UPCOMING';
    if (!type) continue;

    // Tenants who live there at the due date and whose lease has not ended before the month starts
    const tenants = await Tenant.find({
      isActive: true,
      leaseStart: { $lte: dueDate },
      leaseEnd: { $gte: monthStart },
    }).populate('flat', 'flatNumber monthlyRent');
    if (tenants.length === 0) continue;

    const paidIds = await Payment.distinct('tenant', { month, tenant: { $in: tenants.map((t) => t._id) } });
    const paid = new Set(paidIds.map(String));

    for (const tenant of tenants.filter((t) => !paid.has(String(t._id)))) {
      const message = buildMessage(type, tenant, month, dueDate);
      const reminder = await claimReminder({
        tenant: tenant._id,
        flat: tenant.flat?._id,
        month,
        type,
        dueDate,
        message,
      });
      if (!reminder) {
        summary.alreadySent += 1;
        continue;
      }

      try {
        const { channel } = await notify({ tenant, month, type, dueDate, message });
        reminder.status = 'sent';
        reminder.channel = channel || '';
        reminder.sentAt = new Date();
        reminder.error = '';
        summary[type === 'UPCOMING' ? 'upcoming' : 'overdue'] += 1;
      } catch (err) {
        reminder.status = 'failed';
        reminder.error = String(err.message || err).slice(0, 300);
        summary.failed += 1;
      }
      await reminder.save();
    }
  }

  return summary;
}

module.exports = { sendDueReminders, getConfig, buildMessage };
