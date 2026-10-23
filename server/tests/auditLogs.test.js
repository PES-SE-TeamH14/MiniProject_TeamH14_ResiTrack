
process.env.NODE_ENV = 'test';

const app = require('../src/app');
const AuditLog = require('../src/models/AuditLog');
const db = require('./helpers/db');
const { loginAs, as } = require('./helpers/auth');

beforeAll(async () => {
  await db.connect();
});

afterEach(() => db.clear());
afterAll(() => db.close());

describe('GET /api/audit-logs', () => {
  it('allows admins to retrieve audit logs, newest first', async () => {
    const admin = await loginAs('admin');
    const api = as(app, admin.header);

    await AuditLog.create([
      {
        actorId: admin.user._id,
        action: 'FLAT_CREATED',
        resourceType: 'Flat',
        resourceId: 'flat-1',
        timestamp: new Date('2026-01-01T10:00:00Z'),
      },
      {
        actorId: admin.user._id,
        action: 'TENANT_UPDATED',
        resourceType: 'Tenant',
        resourceId: 'tenant-1',
        timestamp: new Date('2026-01-02T10:00:00Z'),
      },
    ]);

    const res = await api.get('/api/audit-logs');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.logs[0].action).toBe('TENANT_UPDATED');
    expect(res.body.logs[1].action).toBe('FLAT_CREATED');
    expect(res.body.logs[0].actorId.name).toBe('Test admin');
    expect(res.body.logs[0].timestamp).toBeDefined();
  });

  it('rejects residents', async () => {
    const resident = await loginAs('resident');
    const res = await as(app, resident.header).get('/api/audit-logs');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects requests without authentication', async () => {
    const request = require('supertest');
    const res = await request(app).get('/api/audit-logs');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('limits the number of returned entries', async () => {
    const admin = await loginAs('admin');
    const api = as(app, admin.header);

    await AuditLog.insertMany(
      Array.from({ length: 5 }, (_, i) => ({
        actorId: admin.user._id,
        action: `ACTION_${i}`,
        resourceType: 'Test',
        timestamp: new Date(Date.UTC(2026, 0, 1, 0, i)),
      })),
    );

    const res = await api.get('/api/audit-logs?limit=2');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });
});
