process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const Flat = require('../src/models/Flat');
const Tenant = require('../src/models/Tenant');
const Payment = require('../src/models/Payment');
const Reminder = require('../src/models/Reminder');
const AuditLog = require('../src/models/AuditLog');
const { sendDueReminders, getConfig } = require('../src/services/reminderService');
const db = require('./helpers/db');
const { loginAs, as } = require('./helpers/auth');

let admin;
let api;
let ravi;
let meera;

beforeAll(async () => {
  await db.connect();
  await Promise.all([Flat.init(), Tenant.init(), Payment.init(), Reminder.init()]);
});

beforeEach(async () => {
  // Rent is due on the 5th and reminders start 3 days before (the defaults)
  delete process.env.RENT_DUE_DAY;
  delete process.env.REMINDER_DAYS_BEFORE;

  admin = await loginAs('admin');
  api = as(app, admin.header);

  const [flatA, flatB] = await Flat.create([
    { flatNumber: 'A-101', monthlyRent: 18000, isOccupied: true },
    { flatNumber: 'B-201', monthlyRent: 25000, isOccupied: true },
  ]);
  [ravi, meera] = await Tenant.create([
    {
      name: 'Ravi Kumar',
      email: 'ravi@example.com',
      phone: '9876543210',
      flat: flatA._id,
      leaseStart: '2026-01-01',
      leaseEnd: '2026-12-31',
    },
    {
      name: 'Meera Nair',
      email: 'meera@example.com',
      phone: '9123456780',
      flat: flatB._id,
      leaseStart: '2026-06-01',
      leaseEnd: '2027-05-31',
    },
  ]);
});

afterEach(() => db.clear());
afterAll(() => db.close());

const day = (iso) => new Date(`${iso}T00:00:00.000Z`);

// Marks the given months as paid, so only the month a test cares about is still open
async function payMonths(months, tenants = [ravi, meera]) {
  for (const month of months) {
    for (const tenant of tenants) {
      await Payment.create({ tenant: tenant._id, flat: tenant.flat, month, amount: 1000, paidOn: new Date() });
    }
  }
}

describe('sendDueReminders: when a reminder is due (FR-07, TC-07)', () => {
  it('sends an UPCOMING reminder exactly 3 days before the due date', async () => {
    await payMonths(['2026-10']);
    const summary = await sendDueReminders({ now: day('2026-11-02') });

    expect(summary).toMatchObject({ date: '2026-11-02', upcoming: 2, overdue: 0, failed: 0 });
    const reminders = await Reminder.find({}).sort({ month: 1 });
    expect(reminders).toHaveLength(2);
    expect(reminders[0]).toMatchObject({ month: '2026-11', type: 'UPCOMING', status: 'sent', channel: 'log' });
    expect(reminders[0].sentAt).toBeInstanceOf(Date);
    expect(reminders[0].message).toContain('is due on 05 Nov 2026');
  });

  it('sends nothing more than 3 days before the due date', async () => {
    await payMonths(['2026-09', '2026-10']);
    const summary = await sendDueReminders({ now: day('2026-10-31') }); // 5 days before 5 Nov

    expect(summary).toMatchObject({ upcoming: 0, overdue: 0, failed: 0 });
    expect(await Reminder.countDocuments()).toBe(0);
  });

  it('sends an OVERDUE reminder once the due date has passed', async () => {
    await payMonths(['2026-10']);
    const summary = await sendDueReminders({ now: day('2026-11-06') });

    expect(summary).toMatchObject({ upcoming: 0, overdue: 2 });
    const reminder = await Reminder.findOne({ tenant: ravi._id });
    expect(reminder).toMatchObject({ month: '2026-11', type: 'OVERDUE', status: 'sent' });
    expect(reminder.message).toContain('still unpaid');
  });

  it('reminds on the due date itself', async () => {
    await payMonths(['2026-10']);
    const summary = await sendDueReminders({ now: day('2026-11-05') });
    expect(summary.upcoming).toBe(2);
  });

  it('skips a tenant who has already paid that month', async () => {
    await payMonths(['2026-10']);
    await payMonths(['2026-11'], [ravi]);
    const summary = await sendDueReminders({ now: day('2026-11-02') });

    expect(summary.upcoming).toBe(1);
    const reminders = await Reminder.find({});
    expect(reminders).toHaveLength(1);
    expect(String(reminders[0].tenant)).toBe(String(meera._id));
  });

  it('skips a tenant who has moved out', async () => {
    await payMonths(['2026-10']);
    await Tenant.updateOne({ _id: ravi._id }, { isActive: false, movedOutAt: day('2026-10-20') });
    const summary = await sendDueReminders({ now: day('2026-11-02') });

    expect(summary.upcoming).toBe(1);
    expect(await Reminder.countDocuments({ tenant: ravi._id })).toBe(0);
  });

  it('skips a tenant whose lease ended before the month', async () => {
    await payMonths(['2026-10']);
    await Tenant.updateOne({ _id: ravi._id }, { leaseEnd: day('2026-10-31') });
    const summary = await sendDueReminders({ now: day('2026-11-02') });

    expect(summary.upcoming).toBe(1);
    expect(await Reminder.countDocuments({ tenant: ravi._id })).toBe(0);
  });

  it('skips a tenant whose lease starts after the due date', async () => {
    await payMonths(['2026-10']);
    await Tenant.updateOne({ _id: ravi._id }, { leaseStart: day('2026-11-20') });
    const summary = await sendDueReminders({ now: day('2026-11-02') });

    expect(summary.upcoming).toBe(1);
    expect(await Reminder.countDocuments({ tenant: ravi._id })).toBe(0);
  });

  it('looks into next month when the due date is just after a month end', async () => {
    process.env.RENT_DUE_DAY = '1';
    await payMonths(['2026-09', '2026-10']);
    const summary = await sendDueReminders({ now: day('2026-10-29') }); // 3 days before 1 Nov

    expect(summary.upcoming).toBe(2);
    expect(await Reminder.countDocuments({ month: '2026-11', type: 'UPCOMING' })).toBe(2);
  });

  it('starts earlier when REMINDER_DAYS_BEFORE is larger', async () => {
    process.env.REMINDER_DAYS_BEFORE = '7';
    await payMonths(['2026-09', '2026-10']);
    const summary = await sendDueReminders({ now: day('2026-10-29') }); // 7 days before 5 Nov

    expect(summary.upcoming).toBe(2);
  });
});

describe('sendDueReminders: sending each reminder once', () => {
  it('does not send the same reminder twice', async () => {
    await payMonths(['2026-10']);
    await sendDueReminders({ now: day('2026-11-02') });
    const second = await sendDueReminders({ now: day('2026-11-03') });

    expect(second).toMatchObject({ upcoming: 0, overdue: 0, alreadySent: 2 });
    expect(await Reminder.countDocuments()).toBe(2);
  });

  it('sends the OVERDUE reminder later even though the UPCOMING one was sent', async () => {
    await payMonths(['2026-10']);
    await sendDueReminders({ now: day('2026-11-02') });
    const later = await sendDueReminders({ now: day('2026-11-08') });

    expect(later.overdue).toBe(2);
    expect(await Reminder.countDocuments({ month: '2026-11' })).toBe(4);
  });

  it('records a failed delivery and retries it on the next run', async () => {
    await payMonths(['2026-10']);
    const failing = jest.fn().mockRejectedValue(new Error('gateway down'));
    const first = await sendDueReminders({ now: day('2026-11-02'), notify: failing });

    expect(first).toMatchObject({ upcoming: 0, failed: 2 });
    const failed = await Reminder.findOne({ tenant: ravi._id });
    expect(failed).toMatchObject({ status: 'failed', error: 'gateway down', sentAt: null });

    const second = await sendDueReminders({ now: day('2026-11-03') });
    expect(second).toMatchObject({ upcoming: 2, failed: 0 });
    expect(await Reminder.countDocuments({ status: 'sent' })).toBe(2);
    expect(await Reminder.countDocuments()).toBe(2); // retried the same records
  });

  it('retries a reminder stuck in "pending", but not one that is being sent right now', async () => {
    await payMonths(['2026-10']);
    const base = { flat: ravi.flat, month: '2026-11', type: 'UPCOMING', dueDate: day('2026-11-05'), status: 'pending' };
    const stuck = await Reminder.create({ ...base, tenant: ravi._id });
    await Reminder.create({ ...base, tenant: meera._id, flat: meera.flat });
    await Reminder.collection.updateOne({ _id: stuck._id }, { $set: { updatedAt: new Date(Date.now() - 60 * 60 * 1000) } });

    const summary = await sendDueReminders({ now: day('2026-11-02') });

    expect(summary).toMatchObject({ upcoming: 1, alreadySent: 1 });
    expect((await Reminder.findById(stuck._id)).status).toBe('sent');
    expect((await Reminder.findOne({ tenant: meera._id })).status).toBe('pending');
  });

  it('passes the tenant and the message to the notifier', async () => {
    await payMonths(['2026-10']);
    const notify = jest.fn().mockResolvedValue({ channel: 'email' });
    await sendDueReminders({ now: day('2026-11-02'), notify });

    expect(notify).toHaveBeenCalledTimes(2);
    const arg = notify.mock.calls.find(([a]) => a.tenant.email === 'ravi@example.com')[0];
    expect(arg.type).toBe('UPCOMING');
    expect(arg.message).toContain('Ravi Kumar');
    expect(arg.message).toContain('A-101');
    expect(arg.message).toContain('18000');
    expect(await Reminder.countDocuments({ channel: 'email' })).toBe(2);
  });
});

describe('getConfig', () => {
  it('uses the defaults', () => {
    expect(getConfig()).toEqual({ dueDay: 5, daysBefore: 3 });
  });

  it('reads valid settings from the environment', () => {
    process.env.RENT_DUE_DAY = '10';
    process.env.REMINDER_DAYS_BEFORE = '7';
    expect(getConfig()).toEqual({ dueDay: 10, daysBefore: 7 });
  });

  it('falls back to the defaults for invalid settings', () => {
    process.env.RENT_DUE_DAY = '31'; // not valid in every month
    process.env.REMINDER_DAYS_BEFORE = '2'; // FR-07 asks for at least 3 days
    expect(getConfig()).toEqual({ dueDay: 5, daysBefore: 3 });

    process.env.RENT_DUE_DAY = 'abc';
    process.env.REMINDER_DAYS_BEFORE = '';
    expect(getConfig()).toEqual({ dueDay: 5, daysBefore: 3 });
  });
});

describe('POST /api/reminders/run (UC-07)', () => {
  it('runs the reminders for a given date and writes an audit log entry', async () => {
    await payMonths(['2026-10']);
    const res = await api.post('/api/reminders/run').send({ date: '2026-11-02' });

    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ date: '2026-11-02', upcoming: 2, overdue: 0, failed: 0 });

    const log = await AuditLog.findOne({ action: 'REMINDERS_RUN' });
    expect(log).not.toBeNull();
    expect(String(log.actorId)).toBe(String(admin.user._id));
    expect(log.metadata).toMatchObject({ upcoming: 2 });
  });

  it('runs for today when no date is sent', async () => {
    const res = await api.post('/api/reminders/run').send({});
    expect(res.status).toBe(200);
    expect(res.body.summary.date).toBe(new Date().toISOString().slice(0, 10));
  });

  it.each(['2026-02-30', 'tomorrow', '02-11-2026', 20261102])('rejects the date %p', async (date) => {
    const res = await api.post('/api/reminders/run').send({ date });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', field: 'date' });
    expect(await Reminder.countDocuments()).toBe(0);
  });

  it('needs a login', async () => {
    const res = await request(app).post('/api/reminders/run').send({});
    expect(res.status).toBe(401);
  });

  it.each(['resident', 'maintenance', 'owner'])('is forbidden for the %s role', async (role) => {
    const user = await loginAs(role);
    const res = await as(app, user.header).post('/api/reminders/run').send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await Reminder.countDocuments()).toBe(0);
  });
});

describe('GET /api/reminders', () => {
  beforeEach(async () => {
    await payMonths(['2026-10']);
    await sendDueReminders({ now: day('2026-11-02') });
    await Reminder.updateOne({ tenant: meera._id }, { status: 'failed', error: 'gateway down' });
  });

  it('lists reminders with tenant and flat details', async () => {
    const res = await api.get('/api/reminders');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    const ravis = res.body.reminders.find((r) => r.tenant.name === 'Ravi Kumar');
    expect(ravis).toMatchObject({ month: '2026-11', type: 'UPCOMING', status: 'sent' });
    expect(ravis.flat.flatNumber).toBe('A-101');
  });

  it('filters by status and by month', async () => {
    const failed = await api.get('/api/reminders?status=failed');
    expect(failed.body.count).toBe(1);
    expect(failed.body.reminders[0].tenant.name).toBe('Meera Nair');

    expect((await api.get('/api/reminders?month=2026-11')).body.count).toBe(2);
    expect((await api.get('/api/reminders?month=2026-12')).body.count).toBe(0);
  });

  it('rejects an invalid month or status', async () => {
    const badMonth = await api.get('/api/reminders?month=2026-13');
    expect(badMonth.status).toBe(400);
    expect(badMonth.body.error).toMatchObject({ code: 'INVALID_QUERY', field: 'month' });

    const badStatus = await api.get('/api/reminders?status=done');
    expect(badStatus.status).toBe(400);
    expect(badStatus.body.error).toMatchObject({ code: 'INVALID_QUERY', field: 'status' });
  });

  it('is forbidden for a resident', async () => {
    const resident = await loginAs('resident');
    const res = await as(app, resident.header).get('/api/reminders');
    expect(res.status).toBe(403);
  });
});
