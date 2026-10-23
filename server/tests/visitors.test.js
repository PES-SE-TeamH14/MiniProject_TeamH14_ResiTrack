
process.env.NODE_ENV = 'test';

const app = require('../src/app');
const Visitor = require('../src/models/Visitor');
const AuditLog = require('../src/models/AuditLog');
const db = require('./helpers/db');
const { loginAs, as } = require('./helpers/auth');

beforeAll(async () => {
  await db.connect();
});

let api;
let admin;

beforeEach(async () => {
  admin = await loginAs('admin');
  api = as(app, admin.header);
});

afterEach(() => db.clear());
afterAll(() => db.close());

const sample = {
  visitorName: 'Ravi Kumar',
  contact: '9876543210',
  purpose: 'Delivery',
  flatNumber: 'a-101',
};

describe('POST /api/visitors', () => {
  it('registers a visitor and creates timestamps', async () => {
    const res = await api.post('/api/visitors').send(sample);

    expect(res.status).toBe(201);
    expect(res.body.visitor.visitorName).toBe('Ravi Kumar');
    expect(res.body.visitor.flatNumber).toBe('A-101');
    expect(res.body.visitor.createdAt).toBeDefined();
    expect(res.body.visitor.updatedAt).toBeDefined();
    expect(await Visitor.countDocuments()).toBe(1);
  });

  it('creates an audit entry for an admin visitor registration', async () => {
    const res = await api.post('/api/visitors').send(sample);

    expect(res.status).toBe(201);

    const logs = await AuditLog.find({ action: 'VISITOR_REGISTERED' }).lean();

    expect(logs).toHaveLength(1);
    expect(String(logs[0].actorId)).toBe(String(admin.user._id));
    expect(logs[0].resourceType).toBe('Visitor');
    expect(logs[0].resourceId).toBe(String(res.body.visitor._id));
    expect(logs[0].timestamp).toBeDefined();
  });

  it('does not include visitor personal details in the audit entry', async () => {
    await api.post('/api/visitors').send(sample);

    const log = await AuditLog.findOne({
      action: 'VISITOR_REGISTERED',
    }).lean();

    expect(log).not.toBeNull();

    const serializedLog = JSON.stringify(log);
    expect(serializedLog).not.toContain(sample.visitorName);
    expect(serializedLog).not.toContain(sample.contact);
    expect(serializedLog).not.toContain(sample.purpose);
    expect(serializedLog).not.toContain(sample.flatNumber);
  });

  it('requires the visitor name', async () => {
    const missingName = { ...sample };
    delete missingName.visitorName;

    const res = await api.post('/api/visitors').send(missingName);

    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('visitorName');
    expect(await AuditLog.countDocuments()).toBe(0);
  });

  it('requires contact, purpose and flat number', async () => {
    for (const field of ['contact', 'purpose', 'flatNumber']) {
      const payload = { ...sample };
      delete payload[field];

      const res = await api.post('/api/visitors').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error.field).toBe(field);
    }

    expect(await AuditLog.countDocuments()).toBe(0);
  });

  it('does not allow the client to set the creation timestamp', async () => {
    const res = await api
      .post('/api/visitors')
      .send({ ...sample, createdAt: '2000-01-01T00:00:00.000Z' });

    expect(res.status).toBe(201);
    expect(new Date(res.body.visitor.createdAt).getFullYear()).not.toBe(2000);
  });
});

describe('GET /api/visitors', () => {
  it('lists visitors with the newest entry first', async () => {
    await Visitor.create({ ...sample, visitorName: 'First visitor' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await Visitor.create({ ...sample, visitorName: 'Second visitor' });

    const res = await api.get('/api/visitors');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.visitors[0].visitorName).toBe('Second visitor');
    expect(res.body.visitors[1].visitorName).toBe('First visitor');
  });

  it('returns an empty list when there are no visitors', async () => {
    const res = await api.get('/api/visitors');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.visitors).toEqual([]);
  });
});
