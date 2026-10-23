process.env.NODE_ENV = 'test';

const app = require('../src/app');
const Flat = require('../src/models/Flat');
const Tenant = require('../src/models/Tenant');
const AuditLog = require('../src/models/AuditLog');
const db = require('./helpers/db');
const { loginAs, as } = require('./helpers/auth');

let admin;
let api;
let flat;

beforeAll(async () => {
  await db.connect();
  await Promise.all([Flat.init(), Tenant.init()]);
});

beforeEach(async () => {
  admin = await loginAs('admin');
  api = as(app, admin.header);
  flat = await Flat.create({
    flatNumber: 'A-101',
    block: 'A',
    floor: 1,
    monthlyRent: 18000,
  });
});

afterEach(() => db.clear());
afterAll(() => db.close());

function tenantData(overrides = {}) {
  return {
    name: 'Ravi Kumar',
    email: 'ravi@example.com',
    phone: '9876543210',
    flat: flat._id.toString(),
    leaseStart: '2026-11-01',
    leaseEnd: '2027-10-31',
    ...overrides,
  };
}

describe('POST /api/tenants (FR-01, TC-01)', () => {
  it('registers a tenant with all fields and marks the flat occupied', async () => {
    const res = await api.post('/api/tenants').send(tenantData());

    expect(res.status).toBe(201);

    const { tenant } = res.body;
    expect(tenant.name).toBe('Ravi Kumar');
    expect(tenant.email).toBe('ravi@example.com');
    expect(tenant.phone).toBe('9876543210');
    expect(tenant.flat.flatNumber).toBe('A-101');
    expect(new Date(tenant.leaseStart).toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(tenant.isActive).toBe(true);

    const saved = await Tenant.findById(tenant._id);
    expect(saved).not.toBeNull();
    expect((await Flat.findById(flat._id)).isOccupied).toBe(true);
  });

  it('creates a TENANT_CREATED audit entry without tenant contact details', async () => {
    const res = await api.post('/api/tenants').send(tenantData());

    expect(res.status).toBe(201);

    const log = await AuditLog.findOne({
      action: 'TENANT_CREATED',
      resourceId: String(res.body.tenant._id),
    }).lean();

    expect(log).not.toBeNull();
    expect(String(log.actorId)).toBe(String(admin.user._id));
    expect(log.resourceType).toBe('Tenant');
    expect(log.timestamp).toBeDefined();
    expect(JSON.stringify(log)).not.toContain('ravi@example.com');
    expect(JSON.stringify(log)).not.toContain('9876543210');
  });

  it.each([
    ['name', { name: '' }],
    ['email', { email: undefined }],
    ['phone', { phone: undefined }],
    ['leaseStart', { leaseStart: undefined }],
    ['flat', { flat: undefined }],
  ])('requires %s', async (field, overrides) => {
    const res = await api.post('/api/tenants').send(tenantData(overrides));

    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe(field);
    expect(await AuditLog.countDocuments({ action: 'TENANT_CREATED' })).toBe(0);
  });

  it('rejects an invalid email', async () => {
    const res = await api.post('/api/tenants').send(tenantData({ email: 'not-an-email' }));

    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('email');
  });

  it('rejects an invalid phone number', async () => {
    const res = await api.post('/api/tenants').send(tenantData({ phone: '12ab' }));

    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('phone');
  });

  it('rejects a lease that ends before it starts', async () => {
    const res = await api.post('/api/tenants').send(
      tenantData({ leaseStart: '2027-01-01', leaseEnd: '2026-12-31' }),
    );

    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('leaseEnd');
  });

  it('rejects a malformed or unknown flat', async () => {
    const malformed = await api.post('/api/tenants').send(tenantData({ flat: 'abc' }));
    const unknown = await api.post('/api/tenants').send(
      tenantData({ flat: '64b000000000000000000000' }),
    );

    expect(malformed.status).toBe(400);
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.field).toBe('flat');
  });

  it('does not assign a deactivated flat (TC-12)', async () => {
    await Flat.updateOne({ _id: flat._id }, { isActive: false });
    const res = await api.post('/api/tenants').send(tenantData());

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('FLAT_INACTIVE');
    expect(await Tenant.countDocuments()).toBe(0);
    expect(await AuditLog.countDocuments({ action: 'TENANT_CREATED' })).toBe(0);
  });

  it('does not assign an occupied flat', async () => {
    await api.post('/api/tenants').send(tenantData());

    const res = await api.post('/api/tenants').send(
      tenantData({ name: 'Second Person', email: 'second@example.com' }),
    );

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('FLAT_OCCUPIED');
    expect(await AuditLog.countDocuments({ action: 'TENANT_CREATED' })).toBe(1);
  });

  it('rejects a duplicate email with 409 and leaves the new flat vacant', async () => {
    await api.post('/api/tenants').send(tenantData());
    const other = await Flat.create({ flatNumber: 'A-102', monthlyRent: 18000 });

    const res = await api.post('/api/tenants').send(
      tenantData({
        name: 'Copy',
        email: 'RAVI@example.com',
        flat: other._id.toString(),
      }),
    );

    expect(res.status).toBe(409);
    expect(res.body.error.field).toBe('email');
    expect((await Flat.findById(other._id)).isOccupied).toBe(false);
    expect(await AuditLog.countDocuments({ action: 'TENANT_CREATED' })).toBe(1);
  });
});

describe('GET /api/tenants', () => {
  beforeEach(async () => {
    const b = await Flat.create({ flatNumber: 'B-201', monthlyRent: 20000 });

    await Tenant.create([
      { ...tenantData(), name: 'Anita', email: 'anita@example.com' },
      { ...tenantData({ flat: b._id }), name: 'Zoya', email: 'zoya@example.com', isActive: false },
    ]);
  });

  it('lists current tenants by default, with their flat', async () => {
    const res = await api.get('/api/tenants');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.tenants[0].name).toBe('Anita');
    expect(res.body.tenants[0].flat.flatNumber).toBe('A-101');
  });

  it('lists past and all tenants', async () => {
    const past = await api.get('/api/tenants?status=past');
    const all = await api.get('/api/tenants?status=all');

    expect(past.body.tenants[0].name).toBe('Zoya');
    expect(all.body.count).toBe(2);
  });

  it('rejects an invalid status filter', async () => {
    const res = await api.get('/api/tenants?status=nope');

    expect(res.status).toBe(400);
  });
});

describe('GET / PATCH /api/tenants/:id', () => {
  let tenantId;

  beforeEach(async () => {
    const res = await api.post('/api/tenants').send(tenantData());
    tenantId = res.body.tenant._id;
  });

  it('returns one tenant', async () => {
    const res = await api.get(`/api/tenants/${tenantId}`);

    expect(res.status).toBe(200);
    expect(res.body.tenant.flat.flatNumber).toBe('A-101');
  });

  it('returns 404 for an unknown tenant', async () => {
    const res = await api.get('/api/tenants/64b000000000000000000000');

    expect(res.status).toBe(404);
  });

  it('updates contact details and lease dates and records the audit event', async () => {
    const res = await api.patch(`/api/tenants/${tenantId}`).send({
      phone: '9123456780',
      leaseEnd: '2028-10-31',
    });

    expect(res.status).toBe(200);
    expect(res.body.tenant.phone).toBe('9123456780');
    expect(new Date(res.body.tenant.leaseEnd).getUTCFullYear()).toBe(2028);

    const log = await AuditLog.findOne({
      action: 'TENANT_UPDATED',
      resourceId: String(tenantId),
    });

    expect(log).not.toBeNull();
    expect(String(log.actorId)).toBe(String(admin.user._id));
    expect(log.resourceType).toBe('Tenant');
  });

  it('validates updated lease dates', async () => {
    const res = await api.patch(`/api/tenants/${tenantId}`).send({
      leaseEnd: '2026-01-01',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('leaseEnd');
    expect(await AuditLog.countDocuments({ action: 'TENANT_UPDATED' })).toBe(0);
  });

  it('does not change the flat through PATCH', async () => {
    const other = await Flat.create({ flatNumber: 'C-301', monthlyRent: 22000 });
    const res = await api.patch(`/api/tenants/${tenantId}`).send({
      flat: other._id.toString(),
    });

    expect(res.body.tenant.flat.flatNumber).toBe('A-101');
  });
});

describe('POST /api/tenants/:id/move-out', () => {
  it('ends the tenancy, frees the flat and records the audit event', async () => {
    const created = await api.post('/api/tenants').send(tenantData());
    const id = created.body.tenant._id;

    const res = await api.post(`/api/tenants/${id}/move-out`);

    expect(res.status).toBe(200);
    expect(res.body.tenant.isActive).toBe(false);
    expect(res.body.tenant.movedOutAt).toBeTruthy();
    expect((await Flat.findById(flat._id)).isOccupied).toBe(false);

    const log = await AuditLog.findOne({
      action: 'TENANT_MOVED_OUT',
      resourceId: String(id),
    });

    expect(log).not.toBeNull();
    expect(String(log.actorId)).toBe(String(admin.user._id));
    expect(log.resourceType).toBe('Tenant');

    const deactivate = await api.patch(`/api/flats/${flat._id}`).send({ isActive: false });
    expect(deactivate.status).toBe(200);
  });

  it('refuses to move out the same tenant twice', async () => {
    const created = await api.post('/api/tenants').send(tenantData());
    const id = created.body.tenant._id;

    await api.post(`/api/tenants/${id}/move-out`);
    const again = await api.post(`/api/tenants/${id}/move-out`);

    expect(again.status).toBe(409);
    expect(await AuditLog.countDocuments({
      action: 'TENANT_MOVED_OUT',
      resourceId: String(id),
    })).toBe(1);
  });

  it('lets a former tenant register again with the same email', async () => {
    const created = await api.post('/api/tenants').send(tenantData());
    await api.post(`/api/tenants/${created.body.tenant._id}/move-out`);

    const again = await api.post('/api/tenants').send(tenantData());

    expect(again.status).toBe(201);
    expect(await AuditLog.countDocuments({ action: 'TENANT_CREATED' })).toBe(2);
  });

  it('returns 404 for an unknown tenant', async () => {
    const res = await api.post('/api/tenants/64b000000000000000000000/move-out');

    expect(res.status).toBe(404);
    expect(await AuditLog.countDocuments({ action: 'TENANT_MOVED_OUT' })).toBe(0);
  });
});
