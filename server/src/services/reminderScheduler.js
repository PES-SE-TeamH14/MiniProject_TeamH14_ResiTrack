const cron = require('node-cron');
const { sendDueReminders } = require('./reminderService');

const DEFAULT_SCHEDULE = '0 9 * * *'; // every day at 09:00
const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Starts the daily rent-reminder job (FR-07).
 *   REMINDERS_ENABLED=false  switches it off
 *   REMINDER_CRON            cron expression (default "0 9 * * *")
 *   REMINDER_TIMEZONE        time zone for the schedule (default Asia/Kolkata)
 * Returns the scheduled task, or null when nothing was started.
 */
function startReminderScheduler() {
  if (process.env.NODE_ENV === 'test' || process.env.REMINDERS_ENABLED === 'false') return null;

  const expression = process.env.REMINDER_CRON || DEFAULT_SCHEDULE;
  if (!cron.validate(expression)) {
    console.error(`Reminder job not started: "${expression}" is not a valid cron expression.`);
    return null;
  }

  const task = cron.schedule(
    expression,
    async () => {
      try {
        const summary = await sendDueReminders();
        console.log(
          `Reminder job done: ${summary.upcoming} upcoming, ${summary.overdue} overdue, ${summary.failed} failed.`,
        );
      } catch (err) {
        console.error('Reminder job failed:', err.message);
      }
    },
    { timezone: process.env.REMINDER_TIMEZONE || DEFAULT_TIMEZONE },
  );
  console.log(`Rent reminder job scheduled (${expression}, ${process.env.REMINDER_TIMEZONE || DEFAULT_TIMEZONE}).`);
  return task;
}

module.exports = { startReminderScheduler };
