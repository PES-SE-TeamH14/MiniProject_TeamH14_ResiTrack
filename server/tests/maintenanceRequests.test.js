process.env.NODE_ENV = 'test';

const app = require('../src/app');
const MaintenanceRequest = require('../src/models/MaintenanceRequest');
const AuditLog = require('../src/models/AuditLog');
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

// FR-05 (#12, UC-05, TC-05): maintenance staff update a request's status
describe('PATCH /api/maintenance-requests/:id', () => {
  async function createRequest() {
    const resident = await loginAs('resident');
    const created = await as(app, resident.header).post('/api/maintenance-requests').send(sample);
    return { resident, request: created.body.request };
  }

  it('lets maintenance staff change the status and saves it with history', async () => {
    const { resident, request } = await createRequest();
    const staff = await loginAs('maintenance');

    const response = await as(app, staff.header)
      .patch(`/api/maintenance-requests/${request._id}`)
      .send({ status: 'In Progress' });

    expect(response.status).toBe(200);
    expect(response.body.request.status).toBe('In Progress');
    expect(response.body.message).toMatch(/In Progress/);

    const saved = await MaintenanceRequest.findById(request._id);
    expect(saved.status).toBe('In Progress');
    expect(saved.statusHistory.map((entry) => entry.status)).toEqual(['Open', 'In Progress']);
    expect(String(saved.statusHistory[1].changedBy)).toBe(String(staff.user._id));

    // The resident sees the new status on their next fetch (the page polls every 3 s)
    const residentView = await as(app, resident.header).get('/api/maintenance-requests');
    expect(residentView.body.requests[0].status).toBe('In Progress');
  });

  it('lets an admin move a request (FR-09 Kanban) and audits it', async () => {
    const { request } = await createRequest();
    const admin = await loginAs('admin');

    const response = await as(app, admin.header)
      .patch(`/api/maintenance-requests/${request._id}`)
      .send({ status: 'Resolved' });

    expect(response.status).toBe(200);
    expect(response.body.request.status).toBe('Resolved');
    const log = await AuditLog.findOne({ action: 'MAINTENANCE_STATUS_UPDATED' });
    expect(log.metadata).toEqual({ from: 'Open', to: 'Resolved' });
  });

  it.each(['resident', 'owner'])('returns 403 for a %s and leaves the status unchanged', async (role) => {
    const { request } = await createRequest();
    const user = await loginAs(role);

    const response = await as(app, user.header)
      .patch(`/api/maintenance-requests/${request._id}`)
      .send({ status: 'Resolved' });

    expect(response.status).toBe(403);
    expect((await MaintenanceRequest.findById(request._id)).status).toBe('Open');
  });

  it('requires authentication', async () => {
    const { request } = await createRequest();
    const supertest = require('supertest');
    const response = await supertest(app)
      .patch(`/api/maintenance-requests/${request._id}`)
      .send({ status: 'Resolved' });
    expect(response.status).toBe(401);
  });

  it('rejects an invalid or unchanged status', async () => {
    const { request } = await createRequest();
    const staff = await loginAs('maintenance');
    const api = as(app, staff.header);

    for (const status of [undefined, 'Closed', 42]) {
      const response = await api.patch(`/api/maintenance-requests/${request._id}`).send({ status });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_STATUS');
    }

    const unchanged = await api.patch(`/api/maintenance-requests/${request._id}`).send({ status: 'Open' });
    expect(unchanged.status).toBe(400);
    expect(unchanged.body.error.code).toBe('STATUS_UNCHANGED');
  });

  it('changes only the status, ignoring other fields', async () => {
    const { request } = await createRequest();
    const staff = await loginAs('maintenance');

    await as(app, staff.header)
      .patch(`/api/maintenance-requests/${request._id}`)
      .send({ status: 'In Progress', description: 'Tampered', priority: 'Low' });

    const saved = await MaintenanceRequest.findById(request._id);
    expect(saved.description).toBe(sample.description);
    expect(saved.priority).toBe(sample.priority);
  });

  it('returns 404 for an unknown or malformed id', async () => {
    const staff = await loginAs('maintenance');
    const api = as(app, staff.header);
    const missing = await api.patch('/api/maintenance-requests/507f1f77bcf86cd799439011').send({ status: 'Resolved' });
    expect(missing.status).toBe(404);
    const malformed = await api.patch('/api/maintenance-requests/not-an-id').send({ status: 'Resolved' });
    expect(malformed.status).toBe(404);
  });
});
