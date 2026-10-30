process.env.NODE_ENV = 'test';

const app = require('../src/app');
const Flat = require('../src/models/Flat');
const Tenant = require('../src/models/Tenant');
const Payment = require('../src/models/Payment');
const { currentMonth, shiftMonth } = require('../src/controllers/reportController');
const db = require('./helpers/db');
const { loginAs, as } = require('./helpers/auth');

const URL = '/api/reports/financial-summary';

let owner;
let api;

beforeAll(async () => {
  await db.connect();
  await Promise.all([Flat.init(), Tenant.init(), Payment.init()]);
});

beforeEach(async () => {
  owner = await loginAs('owner');
  api = as(app, owner.header);
});

afterEach(() => db.clear());
afterAll(() => db.close());

/**
 * Four active flats (three occupied), one deactivated flat, three current tenants and one who moved out.
 * October 2026: Ravi and Meera paid, Arjun did not; Sana (moved out) paid before leaving.
 */
async function seedComplex() {
  const [a101, a102, b201, b202] = await Flat.create([
    { flatNumber: 'A-101', monthlyRent: 18000, isOccupied: true },
    { flatNumber: 'A-102', monthlyRent: 20000, isOccupied: true },
    { flatNumber: 'B-201', monthlyRent: 25000, isOccupied: true },
    { flatNumber: 'B-202', monthlyRent: 22000, isOccupied: false },
  ]);
  await Flat.create({ flatNumber: 'C-301', monthlyRent: 30000, isActive: false, isOccupied: false });

  const lease = { leaseStart: '2026-01-01', leaseEnd: '2026-12-31' };
  const [ravi, meera, arjun, sana] = await Tenant.create([
    { name: 'Ravi Kumar', email: 'ravi@example.com', phone: '9876543210', flat: a101._id, ...lease },
    { name: 'Meera Nair', email: 'meera@example.com', phone: '9123456780', flat: a102._id, ...lease },
    { name: 'Arjun Rao', email: 'arjun@example.com', phone: '9000000001', flat: b201._id, ...lease },
    {
      name: 'Sana Iqbal',
      email: 'sana@example.com',
      phone: '9000000002',
      flat: b202._id,
      ...lease,
      isActive: false,
      movedOutAt: '2026-10-20',
    },
  ]);

  await Payment.create([
    { tenant: ravi._id, flat: a101._id, month: '2026-10', amount: 18000, paidOn: '2026-10-05' },
    { tenant: meera._id, flat: a102._id, month: '2026-10', amount: 19500, paidOn: '2026-10-07' },
    { tenant: sana._id, flat: b202._id, month: '2026-10', amount: 22000, paidOn: '2026-10-02' },
    { tenant: ravi._id, flat: a101._id, month: '2026-09', amount: 18000, paidOn: '2026-09-05' },
    { tenant: arjun._id, flat: b201._id, month: '2026-09', amount: 25000, paidOn: '2026-09-06' },
    { tenant: ravi._id, flat: a101._id, month: '2026-03', amount: 18000, paidOn: '2026-03-05' }, // outside the 6-month trend
  ]);
}

describe('GET /api/reports/financial-summary (FR-10, TC-10)', () => {
  it('returns occupancy, rent and trend totals for the month', async () => {
    await seedComplex();

    const res = await api.get(`${URL}?month=2026-10`);

    expect(res.status).toBe(200);
    expect(res.body.month).toBe('2026-10');
    expect(res.body.occupancy).toEqual({
      totalFlats: 4, // the deactivated flat is not counted
      occupiedFlats: 3,
      vacantFlats: 1,
      occupancyRate: 75,
    });
    expect(res.body.rent).toEqual({
      expected: 63000, // 18000 + 20000 + 25000 (current tenants only)
      collected: 59500, // every payment recorded for October, including Sana's
      dues: 25000, // Arjun has not paid
      payments: 3,
      billableTenants: 3,
      paidTenants: 2,
      unpaidTenants: 1,
      collectionRate: 66.7,
    });
    expect(res.body.trend).toEqual([
      { month: '2026-05', collected: 0 },
      { month: '2026-06', collected: 0 },
      { month: '2026-07', collected: 0 },
      { month: '2026-08', collected: 0 },
      { month: '2026-09', collected: 43000 },
      { month: '2026-10', collected: 59500 },
    ]);
  });

  it('totals match an independent aggregation of the database', async () => {
    await seedComplex();
    const res = await api.get(`${URL}?month=2026-10`);

    // Recompute straight from the collections, without the controller's code
    const flats = await Flat.find({ isActive: true }).lean();
    const [collected] = await Payment.aggregate([
      { $match: { month: '2026-10' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const tenants = await Tenant.find({ isActive: true }).populate('flat').lean();
    const paidIds = (await Payment.find({ month: '2026-10' }).lean()).map((p) => String(p.tenant));
    const unpaid = tenants.filter((t) => !paidIds.includes(String(t._id)));

    expect(res.body.occupancy.totalFlats).toBe(flats.length);
    expect(res.body.occupancy.occupiedFlats).toBe(flats.filter((f) => f.isOccupied).length);
    expect(res.body.rent.collected).toBe(collected.total);
    expect(res.body.rent.payments).toBe(collected.count);
    expect(res.body.rent.expected).toBe(tenants.reduce((sum, t) => sum + t.flat.monthlyRent, 0));
    expect(res.body.rent.dues).toBe(unpaid.reduce((sum, t) => sum + t.flat.monthlyRent, 0));
  });

  it('does not charge rent for a month outside the tenant lease', async () => {
    await seedComplex();
    const res = await api.get(`${URL}?month=2027-02`); // every lease ended in Dec 2026

    expect(res.status).toBe(200);
    expect(res.body.rent).toMatchObject({ expected: 0, dues: 0, billableTenants: 0, collectionRate: 0 });
  });

  it('returns zeros, not errors, for an empty complex', async () => {
    const res = await api.get(`${URL}?month=2026-10`);

    expect(res.status).toBe(200);
    expect(res.body.occupancy).toEqual({ totalFlats: 0, occupiedFlats: 0, vacantFlats: 0, occupancyRate: 0 });
    expect(res.body.rent).toMatchObject({ expected: 0, collected: 0, dues: 0, collectionRate: 0 });
    expect(res.body.trend).toHaveLength(6);
  });

  it('defaults to the current month', async () => {
    const res = await api.get(URL);

    expect(res.status).toBe(200);
    expect(res.body.month).toBe(currentMonth());
  });

  it.each(['2026-13', '2026-1', 'October', ''])('rejects month=%p with 400', async (month) => {
    const res = await api.get(`${URL}?month=${month}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_QUERY');
  });

  it('never exposes tenant names or contact details', async () => {
    await seedComplex();
    const res = await api.get(`${URL}?month=2026-10`);
    const body = JSON.stringify(res.body);

    for (const secret of ['Ravi', 'ravi@example.com', '9876543210', 'A-101']) {
      expect(body).not.toContain(secret);
    }
  });

  it('is also available to admins', async () => {
    const admin = await loginAs('admin');
    const res = await as(app, admin.header).get(`${URL}?month=2026-10`);
    expect(res.status).toBe(200);
  });
});

describe('access to reports (FR-10 read-only, FR-14)', () => {
  it('requires a login', async () => {
    const request = require('supertest');
    const res = await request(app).get(URL);
    expect(res.status).toBe(401);
  });

  it.each(['resident', 'maintenance'])('is forbidden for the %s role', async (role) => {
    const user = await loginAs(role);
    const res = await as(app, user.header).get(URL);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it.each(['post', 'put', 'patch', 'delete'])('refuses %s from an owner with 405 (read-only)', async (method) => {
    const res = await api[method](URL).send({ rent: 0 });

    expect(res.status).toBe(405);
    expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
  });
});

describe('month helpers', () => {
  it('shiftMonth crosses year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-10', -5)).toBe('2026-05');
  });

  it('currentMonth uses India time', () => {
    // 31 Oct 2026, 20:00 UTC is already 1 Nov 2026, 01:30 in India
    expect(currentMonth(new Date('2026-10-31T20:00:00Z'))).toBe('2026-11');
    expect(currentMonth(new Date('2026-10-31T18:00:00Z'))).toBe('2026-10');
  });
});
