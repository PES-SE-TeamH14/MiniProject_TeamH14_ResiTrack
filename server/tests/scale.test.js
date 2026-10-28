// NFR-08 (#23, TC-NFR-08): the API stays fast with 500 tenants, and reference fields are indexed.
const db = require('./helpers/db');
const { as } = require('./helpers/auth');
const app = require('../src/app');
const { signToken } = require('../src/utils/token');
const { seedPerfData } = require('../scripts/perf/seedPerfData');
const Flat = require('../src/models/Flat');
const Tenant = require('../src/models/Tenant');
const Payment = require('../src/models/Payment');
const Visitor = require('../src/models/Visitor');
const Complaint = require('../src/models/Complaint');

const LIMIT_MS = 3000;
const timings = [];
let seed;
let api;

beforeAll(async () => {
  await db.connect();
  seed = await seedPerfData({ tenants: 500 });
  api = as(app, `Bearer ${signToken(seed.admin)}`);
}, 120000);

afterAll(async () => {
  console.log(`Response times with 500 tenants:\n${timings.map((t) => `  ${t}`).join('\n')}`);
  await db.close();
});

async function timedGet(url) {
  const started = Date.now();
  const res = await api.get(url);
  const elapsed = Date.now() - started;
  timings.push(`${url}: ${elapsed} ms`);
  return { res, elapsed };
}

/** The winning query plan as text, e.g. contains "IXSCAN" when an index is used. */
async function planOf(query) {
  const explained = await query.explain('queryPlanner');
  const result = Array.isArray(explained) ? explained[0] : explained;
  return JSON.stringify(result.queryPlanner.winningPlan);
}

describe('seeded data (500 tenants)', () => {
  test('database holds 500 flats, 500 current tenants and their payments', async () => {
    expect(await Flat.countDocuments()).toBe(500);
    expect(await Tenant.countDocuments({ isActive: true })).toBe(500);
    expect(await Payment.countDocuments()).toBe(seed.counts.payments);
    expect(seed.counts.payments).toBe(500 + 500 + 350);
  });
});

describe('list endpoints respond within 3 s with 500 tenants', () => {
  test('GET /api/tenants returns all 500 current tenants with their flats', async () => {
    const { res, elapsed } = await timedGet('/api/tenants');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(500);
    expect(res.body.tenants[0].flat.flatNumber).toBeDefined();
    expect(elapsed).toBeLessThan(LIMIT_MS);
  });

  test('GET /api/flats returns all 500 flats', async () => {
    const { res, elapsed } = await timedGet('/api/flats');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(500);
    expect(elapsed).toBeLessThan(LIMIT_MS);
  });

  test('GET /api/payments/status covers all 500 tenants for the month', async () => {
    const { res, elapsed } = await timedGet(`/api/payments/status?month=${seed.currentMonth}`);
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ tenants: 500, paid: 350, unpaid: 150 });
    expect(elapsed).toBeLessThan(LIMIT_MS);
  });

  test('GET /api/payments lists a month and the full history', async () => {
    const month = await timedGet(`/api/payments?month=${seed.currentMonth}`);
    expect(month.res.status).toBe(200);
    expect(month.res.body.count).toBe(350);
    expect(month.elapsed).toBeLessThan(LIMIT_MS);

    const all = await timedGet('/api/payments');
    expect(all.res.status).toBe(200);
    expect(all.res.body.count).toBe(seed.counts.payments);
    expect(all.elapsed).toBeLessThan(LIMIT_MS);
  });

  test('GET /api/visitors and /api/complaints list newest first', async () => {
    const visitors = await timedGet('/api/visitors');
    expect(visitors.res.status).toBe(200);
    expect(visitors.res.body.count).toBe(seed.counts.visitors);
    expect(visitors.elapsed).toBeLessThan(LIMIT_MS);

    const complaints = await timedGet('/api/complaints');
    expect(complaints.res.status).toBe(200);
    expect(complaints.res.body.count).toBe(seed.counts.complaints);
    const [first, second] = complaints.res.body.complaints;
    expect(new Date(first.createdAt) >= new Date(second.createdAt)).toBe(true);
    expect(complaints.elapsed).toBeLessThan(LIMIT_MS);
  });
});

describe('indexes on reference and sort fields', () => {
  test.each([
    ['tenants', Tenant, { flat: 1 }],
    ['tenants', Tenant, { isActive: 1, name: 1 }],
    ['payments', Payment, { tenant: 1, month: 1 }],
    ['payments', Payment, { flat: 1 }],
    ['payments', Payment, { paidOn: -1, createdAt: -1 }],
    ['flats', Flat, { block: 1, flatNumber: 1 }],
    ['visitors', Visitor, { flatNumber: 1, createdAt: -1 }],
    ['complaints', Complaint, { flatNumber: 1, createdAt: -1 }],
  ])('%s has an index on %o', async (_name, Model, key) => {
    const indexes = await Model.collection.indexes();
    expect(indexes.map((index) => JSON.stringify(index.key))).toContain(JSON.stringify(key));
  });

  test('finding the tenant of a flat uses the flat index, not a full scan', async () => {
    const flat = await Flat.findOne({ flatNumber: 'C-505' });
    const plan = await planOf(Tenant.find({ flat: flat._id }));
    expect(plan).toContain('IXSCAN');
    expect(plan).not.toContain('COLLSCAN');
  });

  test("a tenant's payments are found through the tenant index", async () => {
    const tenant = await Tenant.findOne({ name: 'Tenant 250' });
    const plan = await planOf(Payment.find({ tenant: tenant._id }));
    expect(plan).toContain('IXSCAN');
    expect(plan).not.toContain('COLLSCAN');
  });

  test('the tenant list is read in name order from the index (no in-memory sort)', async () => {
    const plan = await planOf(Tenant.find({ isActive: true }).sort({ name: 1 }));
    expect(plan).toContain('IXSCAN');
    expect(plan).not.toContain('"stage":"SORT"');
  });
});
