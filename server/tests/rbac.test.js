const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
const app = require('../src/app');
const User = require('../src/models/User');
const db = require('./helpers/db');
const { loginAs } = require('./helpers/auth');

beforeAll(() => db.connect());
afterEach(() => db.clear());
afterAll(() => db.close());

const SECRET = 'test-secret';
const nowSeconds = () => Math.floor(Date.now() / 1000);

describe('protect: who is logged in (FR-14, TC-14)', () => {
  it('rejects a request with no token with 401 AUTH_REQUIRED', async () => {
    const res = await request(app).get('/api/flats');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('rejects a header that is not a Bearer token', async () => {
    const admin = await loginAs('admin');
    const res = await request(app).get('/api/flats').set('Authorization', admin.token);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('rejects a tampered token with 401 INVALID_TOKEN', async () => {
    const admin = await loginAs('admin');
    const forged = jwt.sign({ sub: String(admin.user._id), role: 'admin' }, 'some-other-secret');
    const res = await request(app).get('/api/flats').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects garbage in place of a token with 401 INVALID_TOKEN', async () => {
    const res = await request(app).get('/api/flats').set('Authorization', 'Bearer not.a.token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects an expired token with 401 SESSION_EXPIRED (NFR-05)', async () => {
    const admin = await loginAs('admin');
    const expired = jwt.sign(
      { sub: String(admin.user._id), role: 'admin', iat: nowSeconds() - 31 * 60 },
      SECRET,
      { expiresIn: '30m' },
    );
    const res = await request(app).get('/api/flats').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('does not refresh an expired token', async () => {
    const admin = await loginAs('admin');
    const expired = jwt.sign(
      { sub: String(admin.user._id), role: 'admin', iat: nowSeconds() - 31 * 60 },
      SECRET,
      { expiresIn: '30m' },
    );
    const res = await request(app).get('/api/flats').set('Authorization', `Bearer ${expired}`);
    expect(res.headers['x-auth-token']).toBeUndefined();
  });

  it('accepts a token that is still inside the 30-minute window', async () => {
    const admin = await loginAs('admin');
    const recent = jwt.sign(
      { sub: String(admin.user._id), role: 'admin', iat: nowSeconds() - 29 * 60 },
      SECRET,
      { expiresIn: '30m' },
    );
    const res = await request(app).get('/api/flats').set('Authorization', `Bearer ${recent}`);
    expect(res.status).toBe(200);
  });

  it('rejects a token for a user who has been deactivated', async () => {
    const admin = await loginAs('admin');
    await User.updateOne({ _id: admin.user._id }, { isActive: false });
    const res = await request(app).get('/api/flats').set('Authorization', admin.header);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects a token for a user who no longer exists', async () => {
    const admin = await loginAs('admin');
    await User.deleteOne({ _id: admin.user._id });
    const res = await request(app).get('/api/flats').set('Authorization', admin.header);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('keeps public routes open: health and login need no token', async () => {
    const health = await request(app).get('/api/health');
    const login = await request(app).post('/api/auth/login').send({});
    expect(health.status).toBe(200);
    expect(login.status).toBe(400); // reached the login controller, not blocked by protect
  });
});

describe('sliding session: X-Auth-Token (NFR-05)', () => {
  it('sends a fresh token on every authenticated request', async () => {
    const admin = await loginAs('admin');
    const res = await request(app).get('/api/flats').set('Authorization', admin.header);
    expect(res.status).toBe(200);

    const fresh = res.headers['x-auth-token'];
    expect(fresh).toBeDefined();
    const payload = jwt.verify(fresh, SECRET);
    expect(payload.sub).toBe(String(admin.user._id));
    expect(payload.role).toBe('admin');
    expect(payload.exp - payload.iat).toBe(30 * 60);
  });

  it('the fresh token works for the next request', async () => {
    const admin = await loginAs('admin');
    const first = await request(app).get('/api/flats').set('Authorization', admin.header);
    const second = await request(app)
      .get('/api/flats')
      .set('Authorization', `Bearer ${first.headers['x-auth-token']}`);
    expect(second.status).toBe(200);
  });

  it('extends an old-but-valid session to a full 30 minutes from now', async () => {
    const admin = await loginAs('admin');
    const old = jwt.sign(
      { sub: String(admin.user._id), role: 'admin', iat: nowSeconds() - 25 * 60 },
      SECRET,
      { expiresIn: '30m' },
    );
    const res = await request(app).get('/api/flats').set('Authorization', `Bearer ${old}`);
    const payload = jwt.verify(res.headers['x-auth-token'], SECRET);
    expect(payload.exp).toBeGreaterThanOrEqual(nowSeconds() + 29 * 60);
  });

  it('lets the browser read the header through CORS', async () => {
    const admin = await loginAs('admin');
    const res = await request(app)
      .get('/api/flats')
      .set('Origin', 'http://localhost:5173')
      .set('Authorization', admin.header);
    expect(res.headers['access-control-expose-headers']).toMatch(/X-Auth-Token/i);
  });

  it('does not send a token on failed logins or public routes', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-auth-token']).toBeUndefined();
  });
});

describe('authorize: role allowlists (FR-14, SEC-03)', () => {
  // [method, url, roles allowed]. Anything not listed for a role must be refused.
  const ROUTES = [
    ['get', '/api/flats', ['admin']],
    ['post', '/api/flats', ['admin']],
    ['patch', '/api/flats/64b000000000000000000000', ['admin']],
    ['get', '/api/tenants', ['admin']],
    ['post', '/api/tenants', ['admin']],
    ['post', '/api/tenants/64b000000000000000000000/move-out', ['admin']],
    ['get', '/api/payments', ['admin']],
    ['post', '/api/payments', ['admin']],
    ['get', '/api/payments/status', ['admin']],
    ['post', '/api/visitors', ['resident', 'admin']],
    ['get', '/api/visitors', ['admin']],
    ['post', '/api/complaints', ['resident', 'admin']],
    ['get', '/api/complaints', ['resident', 'admin', 'maintenance']],
    ['patch', '/api/complaints/64b000000000000000000000/status', ['admin', 'maintenance']],
  ];

  it('every protected route rejects a request with no token', async () => {
    for (const [method, url] of ROUTES) {
      const res = await request(app)[method](url).send({});
      expect({ method, url, status: res.status }).toEqual({ method, url, status: 401 });
    }
  });

  it('refuses each role on routes it is not allowed, with 403 FORBIDDEN', async () => {
    for (const role of User.ROLES) {
      const { header } = await loginAs(role);
      for (const [method, url, allowed] of ROUTES) {
        const res = await request(app)[method](url).set('Authorization', header).send({});
        if (allowed.includes(role)) {
          expect({ role, method, url, denied: res.status === 403 }).toEqual({ role, method, url, denied: false });
        } else {
          expect({ role, method, url, status: res.status, code: res.body.error?.code }).toEqual({
            role,
            method,
            url,
            status: 403,
            code: 'FORBIDDEN',
          });
        }
      }
    }
  });

  it('does not touch the database when the role is refused', async () => {
    const resident = await loginAs('resident');
    const res = await request(app)
      .post('/api/flats')
      .set('Authorization', resident.header)
      .send({ flatNumber: 'Z-999', monthlyRent: 1000 });
    expect(res.status).toBe(403);
    const Flat = require('../src/models/Flat');
    expect(await Flat.countDocuments()).toBe(0);
  });

  it('uses the role stored in the database, not the one in the token', async () => {
    const user = await loginAs('admin');
    await User.updateOne({ _id: user.user._id }, { role: 'resident' });
    const res = await request(app).get('/api/flats').set('Authorization', user.header);
    expect(res.status).toBe(403);
  });
});

describe('authorize() setup errors', () => {
  const { authorize } = require('../src/middleware/auth');

  it('throws if no roles are given', () => {
    expect(() => authorize()).toThrow(/at least one role/);
  });

  it('throws on an unknown role name, catching typos early', () => {
    expect(() => authorize('admn')).toThrow(/unknown role/);
  });
});
