process.env.NODE_ENV = 'test';

const app = require('../src/app');
const Flat = require('../src/models/Flat');
const Tenant = require('../src/models/Tenant');
const Payment = require('../src/models/Payment');
const AuditLog = require('../src/models/AuditLog');
const db = require('./helpers/db');
const { loginAs, as } = require('./helpers/auth');

let admin;
let api;

beforeAll(async () => {
  await db.connect();
  await Promise.all([Flat.init(), Tenant.init(), Payment.init()]);
});

beforeEach(async () => {
  admin = await loginAs('admin');
  api = as(app, admin.header);
});

afterEach(() => db.clear());
afterAll(() => db.close());

let flatA;
let flatB;
let ravi;
let meera;

beforeEach(async () => {
  [flatA, flatB] = await Flat.create([
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

function pay(overrides = {}) {
  return api.post('/api/payments').send({
    tenant: ravi._id.toString(),
    month: '2026-10',
    amount: 18000,
    paidOn: '2026-10-05',
    method: 'UPI',
    reference: 'UPI-123',
    ...overrides,
  });
}

describe('POST /api/payments (FR-06, TC-06)', () => {
  it('records a payment with amount, date and flat', async () => {
    const res = await pay();

    expect(res.status).toBe(201);

    const { payment } = res.body;
    expect(payment.amount).toBe(18000);
    expect(new Date(payment.paidOn).toISOString()).toBe('2026-10-05T00:00:00.000Z');
    expect(payment.flat._id).toBe(flatA._id.toString());
    expect(payment.flat.flatNumber).toBe('A-101');
    expect(payment.tenant.name).toBe('Ravi Kumar');
    expect(payment.month).toBe('2026-10');
    expect(await Payment.countDocuments()).toBe(1);
  });

  it('creates a PAYMENT_RECORDED audit entry for the admin', async () => {
    const res = await pay();

    expect(res.status).toBe(201);

    const log = await AuditLog.findOne({
      action: 'PAYMENT_RECORDED',
      resourceId: String(res.body.payment._id),
    }).lean();

    expect(log).not.toBeNull();
    expect(String(log.actorId)).toBe(String(admin.user._id));
    expect(log.resourceType).toBe('Payment');
    expect(log.timestamp).toBeDefined();
    expect(log.metadata.month).toBe('2026-10');

    // Payment references and tenant contact details must not be logged.
    const serializedLog = JSON.stringify(log);
    expect(serializedLog).not.toContain('UPI-123');
    expect(serializedLog).not.toContain('ravi@example.com');
    expect(serializedLog).not.toContain('9876543210');
  });

  it('uses the flat rent when no amount is given', async () => {
    const res = await pay({ amount: undefined });

    expect(res.status).toBe(201);
    expect(res.body.payment.amount).toBe(18000);
  });

  it.each(['2026-13', 'Oct 2026', '2026-1', undefined])(
    'rejects the month %p',
    async (month) => {
      const res = await pay({ month });

      expect(res.status).toBe(400);
      expect(res.body.error.field).toBe('month');
      expect(await AuditLog.countDocuments({ action: 'PAYMENT_RECORDED' })).toBe(0);
    },
  );

  it('rejects a zero or negative amount', async () => {
    const res = await pay({ amount: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('amount');
    expect(await AuditLog.countDocuments({ action: 'PAYMENT_RECORDED' })).toBe(0);
  });

  it('rejects a payment date in the future', async () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const res = await pay({ paidOn: future });

    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('paidOn');
  });

  it('rejects an unknown payment method', async () => {
    const res = await pay({ method: 'Bitcoin' });

    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('method');
  });

  it('rejects a malformed or unknown tenant', async () => {
    const malformed = await pay({ tenant: 'abc' });
    const unknown = await pay({ tenant: '64b000000000000000000000' });

    expect(malformed.status).toBe(400);
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.field).toBe('tenant');
    expect(await AuditLog.countDocuments({ action: 'PAYMENT_RECORDED' })).toBe(0);
  });

  it('does not record rent for a tenant who has moved out', async () => {
    await Tenant.updateOne({ _id: ravi._id }, { isActive: false });
    const res = await pay();

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TENANT_INACTIVE');
    expect(await AuditLog.countDocuments({ action: 'PAYMENT_RECORDED' })).toBe(0);
  });

  it('allows only one payment per tenant per month', async () => {
    await pay();

    const again = await pay({ reference: 'UPI-456' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_PAID');

    const nextMonth = await pay({ month: '2026-09', paidOn: '2026-09-04' });
    expect(nextMonth.status).toBe(201);

    expect(await AuditLog.countDocuments({ action: 'PAYMENT_RECORDED' })).toBe(2);
  });
});

describe('GET /api/payments', () => {
  beforeEach(async () => {
    await pay();
    await pay({ month: '2026-09', paidOn: '2026-09-03' });
    await pay({
      tenant: meera._id.toString(),
      amount: 25000,
      paidOn: '2026-10-07',
    });
  });

  it('lists all payments, newest first, with tenant and flat', async () => {
    const res = await api.get('/api/payments');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
    expect(res.body.payments[0].tenant.name).toBe('Meera Nair');
    expect(res.body.payments[0].flat.flatNumber).toBe('B-201');
  });

  it('filters by month and by tenant', async () => {
    const october = await api.get('/api/payments?month=2026-10');
    const raviOnly = await api.get(`/api/payments?tenant=${ravi._id}`);

    expect(october.body.count).toBe(2);
    expect(raviOnly.body.count).toBe(2);
  });

  it('rejects invalid filters', async () => {
    const badMonth = await api.get('/api/payments?month=10-2026');
    const badTenant = await api.get('/api/payments?tenant=xyz');

    expect(badMonth.status).toBe(400);
    expect(badTenant.status).toBe(400);
  });

  it('returns one payment, or 404', async () => {
    const [first] = (await api.get('/api/payments')).body.payments;
    const found = await api.get(`/api/payments/${first._id}`);
    const missing = await api.get('/api/payments/64b000000000000000000000');

    expect(found.status).toBe(200);
    expect(missing.status).toBe(404);
  });
});

describe('GET /api/payments/status (paid / unpaid per month)', () => {
  it('marks each current tenant Paid or Unpaid, with totals', async () => {
    await pay();

    const res = await api.get('/api/payments/status?month=2026-10');
    expect(res.status).toBe(200);

    const byName = Object.fromEntries(res.body.rows.map((r) => [r.tenant.name, r]));
    expect(byName['Ravi Kumar'].status).toBe('Paid');
    expect(byName['Ravi Kumar'].payment.amount).toBe(18000);
    expect(byName['Meera Nair'].status).toBe('Unpaid');

    expect(res.body.summary).toEqual({
      month: '2026-10',
      tenants: 2,
      paid: 1,
      unpaid: 1,
      expected: 43000,
      collected: 18000,
    });
  });

  it('only includes tenants whose lease covers the month', async () => {
    const res = await api.get('/api/payments/status?month=2026-03');

    expect(res.body.rows.map((r) => r.tenant.name)).toEqual(['Ravi Kumar']);
  });

  it('leaves out tenants who have moved out', async () => {
    await Tenant.updateOne({ _id: meera._id }, { isActive: false });
    const res = await api.get('/api/payments/status?month=2026-10');

    expect(res.body.summary.tenants).toBe(1);
  });

  it('requires a valid month', async () => {
    const missing = await api.get('/api/payments/status');
    const bad = await api.get('/api/payments/status?month=2026-00');

    expect(missing.status).toBe(400);
    expect(bad.status).toBe(400);
  });
});
