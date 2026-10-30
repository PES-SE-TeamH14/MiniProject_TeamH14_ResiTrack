process.env.NODE_ENV = 'test';

const app = require('../src/app');
const MaintenanceRequest = require('../src/models/MaintenanceRequest');
const db = require('./helpers/db');
const { loginAs, as } = require('./helpers/auth');

beforeAll(async () => { await db.connect(); });
afterEach(() => db.clear());
afterAll(() => db.close());

const sample = {
  category: 'Plumbing',
  description: 'The kitchen sink is leaking.',
  priority: 'High',
};

describe('POST /api/maintenance-requests', () => {
  it('saves a resident request with Open status and returns confirmation', async () => {
    const resident = await loginAs('resident');
    const api = as(app, resident.header);
    const response = await api.post('/api/maintenance-requests').send(sample);

    expect(response.status).toBe(201);
    expect(response.body.message).toMatch(/submitted successfully/i);
    expect(response.body.request.category).toBe(sample.category);
    expect(response.body.request.description).toBe(sample.description);
    expect(response.body.request.priority).toBe(sample.priority);
    expect(response.body.request.status).toBe('Open');
    expect(String(response.body.request.resident)).toBe(String(resident.user._id));
    expect(await MaintenanceRequest.countDocuments()).toBe(1);
  });

  it('does not allow the client to choose the initial status', async () => {
    const resident = await loginAs('resident');
    const response = await as(app, resident.header).post('/api/maintenance-requests')
      .send({ ...sample, status: 'Resolved' });
    expect(response.status).toBe(201);
    expect(response.body.request.status).toBe('Open');
  });

  it('requires category, description and priority', async () => {
    const resident = await loginAs('resident');
    const api = as(app, resident.header);
    for (const field of ['category', 'description', 'priority']) {
      const payload = { ...sample };
      delete payload[field];
      const response = await api.post('/api/maintenance-requests').send(payload);
      expect(response.status).toBe(400);
      expect(response.body.error.field).toBe(field);
    }
  });

  it('rejects unknown categories and priorities', async () => {
    const resident = await loginAs('resident');
    const api = as(app, resident.header);

    const badCategory = await api.post('/api/maintenance-requests').send({ ...sample, category: 'Gardening' });
    expect(badCategory.status).toBe(400);
    expect(badCategory.body.error.field).toBe('category');

    const badPriority = await api.post('/api/maintenance-requests').send({ ...sample, priority: 'Whenever' });
    expect(badPriority.status).toBe(400);
    expect(badPriority.body.error.field).toBe('priority');

    expect(await MaintenanceRequest.countDocuments()).toBe(0);
  });

  it('rejects blank or non-text descriptions without crashing', async () => {
    const resident = await loginAs('resident');
    const api = as(app, resident.header);
    for (const description of ['   ', 42, { text: 'x' }]) {
      const response = await api.post('/api/maintenance-requests').send({ ...sample, description });
      expect(response.status).toBe(400);
      expect(response.body.error.field).toBe('description');
    }
    expect(await MaintenanceRequest.countDocuments()).toBe(0);
  });

  it('rejects requests from users who are not residents', async () => {
    const admin = await loginAs('admin');
    const response = await as(app, admin.header).post('/api/maintenance-requests').send(sample);
    expect(response.status).toBe(403);
    expect(await MaintenanceRequest.countDocuments()).toBe(0);
  });

  it('requires authentication', async () => {
    const request = require('supertest');
    const response = await request(app).post('/api/maintenance-requests').send(sample);
    expect(response.status).toBe(401);
  });
});

describe('GET /api/maintenance-requests', () => {
  it('lets residents see only their own requests', async () => {
    const residentOne = await loginAs('resident');
    const residentTwo = await loginAs('resident');
    await MaintenanceRequest.create({ ...sample, resident: residentOne.user._id });
    await MaintenanceRequest.create({ ...sample, resident: residentTwo.user._id, description: 'A different issue.' });

    const response = await as(app, residentOne.header).get('/api/maintenance-requests');
    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.requests[0].description).toBe(sample.description);
  });

  it('lets admin and maintenance staff see all requests', async () => {
    const residentOne = await loginAs('resident');
    const residentTwo = await loginAs('resident');
    await MaintenanceRequest.create({ ...sample, resident: residentOne.user._id });
    await MaintenanceRequest.create({ ...sample, resident: residentTwo.user._id });

    for (const role of ['admin', 'maintenance']) {
      const staff = await loginAs(role);
      const response = await as(app, staff.header).get('/api/maintenance-requests');
      expect(response.status).toBe(200);
      expect(response.body.count).toBe(2);
    }
  });

  it('blocks owners from listing requests', async () => {
    const owner = await loginAs('owner');
    const response = await as(app, owner.header).get('/api/maintenance-requests');
    expect(response.status).toBe(403);
  });
});
