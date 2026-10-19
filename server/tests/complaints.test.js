
const request = require('supertest');

process.env.NODE_ENV = 'test';
const app = require('../src/app');
const Complaint = require('../src/models/Complaint');
const db = require('./helpers/db');

beforeAll(async () => {
  await db.connect();
});

afterEach(() => db.clear());
afterAll(() => db.close());

const sample = {
  title: 'Water leakage',
  description: 'Water is leaking from the bathroom ceiling.',
  category: 'Plumbing',
  flatNumber: 'a-101',
};

describe('POST /api/complaints', () => {
  it('creates a complaint with Open status and initial history', async () => {
    const res = await request(app).post('/api/complaints').send(sample);

    expect(res.status).toBe(201);
    expect(res.body.complaint.title).toBe(sample.title);
    expect(res.body.complaint.flatNumber).toBe('A-101');
    expect(res.body.complaint.status).toBe('Open');
    expect(res.body.complaint.statusHistory).toHaveLength(1);
    expect(res.body.complaint.statusHistory[0].status).toBe('Open');
    expect(res.body.complaint.statusHistory[0].changedAt).toBeDefined();
    expect(await Complaint.countDocuments()).toBe(1);
  });

  it('requires the title', async () => {
    const payload = { ...sample };
    delete payload.title;

    const res = await request(app).post('/api/complaints').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('title');
  });

  it('requires the description, category and flat number', async () => {
    for (const field of ['description', 'category', 'flatNumber']) {
      const payload = { ...sample };
      delete payload[field];

      const res = await request(app).post('/api/complaints').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error.field).toBe(field);
    }
  });

  it('does not allow the client to set the initial status', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .send({ ...sample, status: 'Resolved' });

    expect(res.status).toBe(201);
    expect(res.body.complaint.status).toBe('Open');
  });
});

describe('GET /api/complaints', () => {
  it('lists complaints newest first', async () => {
    await Complaint.create({ ...sample, title: 'First complaint' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await Complaint.create({ ...sample, title: 'Second complaint' });

    const res = await request(app).get('/api/complaints');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.complaints[0].title).toBe('Second complaint');
    expect(res.body.complaints[1].title).toBe('First complaint');
  });

  it('returns an empty list when there are no complaints', async () => {
    const res = await request(app).get('/api/complaints');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.complaints).toEqual([]);
  });
});

describe('PATCH /api/complaints/:id/status', () => {
  let complaint;

  beforeEach(async () => {
    complaint = await Complaint.create(sample);
  });

  it('updates status and appends a timestamped history entry', async () => {
    const res = await request(app)
      .patch(`/api/complaints/${complaint._id}/status`)
      .send({ status: 'In Progress', note: 'Technician assigned' });

    expect(res.status).toBe(200);
    expect(res.body.complaint.status).toBe('In Progress');
    expect(res.body.complaint.statusHistory).toHaveLength(2);
    expect(res.body.complaint.statusHistory[1].status).toBe('In Progress');
    expect(res.body.complaint.statusHistory[1].note).toBe('Technician assigned');
    expect(res.body.complaint.statusHistory[1].changedAt).toBeDefined();
  });

  it('rejects an invalid status', async () => {
    const res = await request(app)
      .patch(`/api/complaints/${complaint._id}/status`)
      .send({ status: 'Cancelled' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_STATUS');
  });

  it('rejects a status update that changes nothing', async () => {
    const res = await request(app)
      .patch(`/api/complaints/${complaint._id}/status`)
      .send({ status: 'Open' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('STATUS_UNCHANGED');
  });

  it('returns 404 for an unknown complaint', async () => {
    const res = await request(app)
      .patch('/api/complaints/64b000000000000000000000/status')
      .send({ status: 'Resolved' });

    expect(res.status).toBe(404);
  });
});
