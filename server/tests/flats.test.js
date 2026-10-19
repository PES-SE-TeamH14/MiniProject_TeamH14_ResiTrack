const request = require('supertest');

process.env.NODE_ENV = 'test';
const app = require('../src/app');
const Flat = require('../src/models/Flat');
const db = require('./helpers/db');

beforeAll(async () => {
  await db.connect();
  await Flat.init(); // build the unique index on flatNumber
});
afterEach(() => db.clear());
afterAll(() => db.close());

const sample = { flatNumber: 'a-101', block: 'A', floor: 1, type: '2BHK', monthlyRent: 18000 };

describe('POST /api/flats (FR-12 add)', () => {
  it('adds a flat and stores the flat number in upper case', async () => {
    const res = await request(app).post('/api/flats').send(sample);
    expect(res.status).toBe(201);
    expect(res.body.flat.flatNumber).toBe('A-101');
    expect(res.body.flat.isActive).toBe(true);
    expect(res.body.flat.isOccupied).toBe(false);
    expect(await Flat.countDocuments()).toBe(1);
  });

  it('requires a flat number', async () => {
    const res = await request(app).post('/api/flats').send({ monthlyRent: 15000 });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('flatNumber');
  });

  it('requires a monthly rent', async () => {
    const res = await request(app).post('/api/flats').send({ flatNumber: 'B-201' });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('monthlyRent');
  });

  it('rejects a negative rent', async () => {
    const res = await request(app).post('/api/flats').send({ ...sample, monthlyRent: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('monthlyRent');
  });

  it('rejects an unknown flat type', async () => {
    const res = await request(app).post('/api/flats').send({ ...sample, type: 'Villa' });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('type');
  });

  it('rejects a duplicate flat number with 409', async () => {
    await request(app).post('/api/flats').send(sample);
    const res = await request(app).post('/api/flats').send({ ...sample, flatNumber: 'A-101' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE');
  });

  it('ignores isOccupied sent by the client', async () => {
    const res = await request(app).post('/api/flats').send({ ...sample, isOccupied: true });
    expect(res.status).toBe(201);
    expect(res.body.flat.isOccupied).toBe(false);
  });
});

describe('GET /api/flats', () => {
  beforeEach(async () => {
    await Flat.create([
      { flatNumber: 'A-101', block: 'A', monthlyRent: 18000 },
      { flatNumber: 'A-102', block: 'A', monthlyRent: 18000, isActive: false },
      { flatNumber: 'A-103', block: 'A', monthlyRent: 20000, isOccupied: true },
    ]);
  });

  it('lists all flats sorted by flat number', async () => {
    const res = await request(app).get('/api/flats');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
    expect(res.body.flats.map((f) => f.flatNumber)).toEqual(['A-101', 'A-102', 'A-103']);
  });

  it('filters active and inactive flats', async () => {
    const active = await request(app).get('/api/flats?status=active');
    const inactive = await request(app).get('/api/flats?status=inactive');
    expect(active.body.count).toBe(2);
    expect(inactive.body.flats[0].flatNumber).toBe('A-102');
  });

  it('available=true returns only active, vacant flats', async () => {
    const res = await request(app).get('/api/flats?available=true');
    expect(res.body.flats.map((f) => f.flatNumber)).toEqual(['A-101']);
  });

  it('rejects an invalid status filter', async () => {
    const res = await request(app).get('/api/flats?status=broken');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/flats/:id', () => {
  it('returns one flat', async () => {
    const flat = await Flat.create({ flatNumber: 'C-301', monthlyRent: 22000 });
    const res = await request(app).get(`/api/flats/${flat._id}`);
    expect(res.status).toBe(200);
    expect(res.body.flat.flatNumber).toBe('C-301');
  });

  it('returns 404 for an unknown or malformed id', async () => {
    const missing = await request(app).get('/api/flats/64b000000000000000000000');
    const malformed = await request(app).get('/api/flats/not-an-id');
    expect(missing.status).toBe(404);
    expect(malformed.status).toBe(404);
  });
});

describe('PATCH /api/flats/:id (FR-12 edit / deactivate)', () => {
  let flat;
  beforeEach(async () => {
    flat = await Flat.create({ flatNumber: 'D-401', block: 'D', monthlyRent: 25000 });
  });

  it('edits a flat', async () => {
    const res = await request(app).patch(`/api/flats/${flat._id}`).send({ monthlyRent: 26000, type: '3BHK' });
    expect(res.status).toBe(200);
    expect(res.body.flat.monthlyRent).toBe(26000);
    expect(res.body.flat.type).toBe('3BHK');
  });

  it('deactivates and reactivates a flat', async () => {
    const off = await request(app).patch(`/api/flats/${flat._id}`).send({ isActive: false });
    expect(off.body.flat.isActive).toBe(false);

    const available = await request(app).get('/api/flats?available=true');
    expect(available.body.count).toBe(0);

    const on = await request(app).patch(`/api/flats/${flat._id}`).send({ isActive: true });
    expect(on.body.flat.isActive).toBe(true);
  });

  it('refuses to deactivate an occupied flat', async () => {
    await Flat.updateOne({ _id: flat._id }, { isOccupied: true });
    const res = await request(app).patch(`/api/flats/${flat._id}`).send({ isActive: false });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('FLAT_OCCUPIED');
  });

  it('validates edited values', async () => {
    const res = await request(app).patch(`/api/flats/${flat._id}`).send({ monthlyRent: -5 });
    expect(res.status).toBe(400);
  });

  it('rejects renaming to an existing flat number', async () => {
    await Flat.create({ flatNumber: 'D-402', monthlyRent: 25000 });
    const res = await request(app).patch(`/api/flats/${flat._id}`).send({ flatNumber: 'd-402' });
    expect(res.status).toBe(409);
  });

  it('returns 404 for an unknown flat', async () => {
    const res = await request(app).patch('/api/flats/64b000000000000000000000').send({ monthlyRent: 1 });
    expect(res.status).toBe(404);
  });
});
