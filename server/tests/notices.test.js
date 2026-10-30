process.env.NODE_ENV = 'test';

const app = require('../src/app');
const Notice = require('../src/models/Notice');
const AuditLog = require('../src/models/AuditLog');
const db = require('./helpers/db');
const { loginAs, as } = require('./helpers/auth');

beforeAll(async () => db.connect());
afterEach(() => db.clear());
afterAll(() => db.close());

describe('community notices (FR-03)', () => {
  it('allows an admin to publish a notice and records an audit event', async () => {
    const admin = await loginAs('admin');
    const res = await as(app, admin.header).post('/api/notices').send({
      title: 'Water shutdown',
      message: 'Water will be unavailable from 10 AM to noon.',
    });

    expect(res.status).toBe(201);
    expect(res.body.notice.title).toBe('Water shutdown');
    expect(res.body.notice.message).toContain('10 AM');
    expect(res.body.notice.isActive).toBe(true);
    expect(String(res.body.notice.publishedBy)).toBe(String(admin.user._id));
    expect(await Notice.countDocuments()).toBe(1);
    expect(await AuditLog.countDocuments({ action: 'NOTICE_CREATED' })).toBe(1);
  });

  it('rejects notice creation by a resident', async () => {
    const resident = await loginAs('resident');
    const res = await as(app, resident.header).post('/api/notices').send({
      title: 'Not allowed', message: 'Residents cannot publish notices.',
    });
    expect(res.status).toBe(403);
    expect(await Notice.countDocuments()).toBe(0);
  });

  it('requires a title and message', async () => {
    const admin = await loginAs('admin');
    const api = as(app, admin.header);
    expect((await api.post('/api/notices').send({ message: 'Body only' })).status).toBe(400);
    expect((await api.post('/api/notices').send({ title: 'Title only' })).status).toBe(400);
    expect(await Notice.countDocuments()).toBe(0);
  });

  it('allows residents to view active notices, newest first, without inactive notices', async () => {
    const admin = await loginAs('admin');
    const resident = await loginAs('resident');
    await Notice.create({ title: 'Older', message: 'First', publishedBy: admin.user._id, publishedAt: new Date('2026-01-01'), isActive: true });
    await Notice.create({ title: 'Newer', message: 'Second', publishedBy: admin.user._id, publishedAt: new Date('2026-01-02'), isActive: true });
    await Notice.create({ title: 'Hidden', message: 'Inactive', publishedBy: admin.user._id, isActive: false });

    const res = await as(app, resident.header).get('/api/notices');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.notices.map((notice) => notice.title)).toEqual(['Newer', 'Older']);
    expect(JSON.stringify(res.body)).not.toContain('Hidden');
  });

  it.each(['maintenance', 'owner'])('lets a %s read notices but not publish them', async (role) => {
    const admin = await loginAs('admin');
    const user = await loginAs(role);
    await Notice.create({ title: 'Lift service', message: 'Lift B is off on Sunday.', publishedBy: admin.user._id });

    const read = await as(app, user.header).get('/api/notices');
    expect(read.status).toBe(200);
    expect(read.body.notices.map((notice) => notice.title)).toEqual(['Lift service']);

    const publish = await as(app, user.header).post('/api/notices').send({ title: 'No', message: 'Not allowed.' });
    expect(publish.status).toBe(403);
    expect(await Notice.countDocuments()).toBe(1);
  });

  it('requires login to view notices', async () => {
    const request = require('supertest');
    const res = await request(app).get('/api/notices');
    expect(res.status).toBe(401);
  });
});
