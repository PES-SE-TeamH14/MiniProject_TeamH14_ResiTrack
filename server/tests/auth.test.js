const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
const app = require('../src/app');
const User = require('../src/models/User');
const db = require('./helpers/db');

beforeAll(async () => {
  await db.connect();
  await User.init(); // build the unique index on email
});
afterEach(() => db.clear());
afterAll(() => db.close());

const resident = {
  name: 'Asha Rao',
  email: 'asha@example.com',
  password: 'correct-horse-9',
  role: 'resident',
};

describe('User model: password storage (NFR-03)', () => {
  it('stores the password as a bcrypt hash with cost 12, never as plain text', async () => {
    await User.create(resident);
    const saved = await User.findOne({ email: resident.email }).select('+password');
    expect(saved.password).not.toBe(resident.password);
    expect(saved.password).toMatch(/^\$2b\$12\$/);
    expect(await saved.comparePassword(resident.password)).toBe(true);
    expect(await saved.comparePassword('wrong-password')).toBe(false);
  });

  it('does not re-hash the password when other fields change', async () => {
    const user = await User.create(resident);
    const before = (await User.findById(user._id).select('+password')).password;

    const loaded = await User.findById(user._id).select('+password');
    loaded.name = 'Asha R.';
    await loaded.save();

    const after = (await User.findById(user._id).select('+password')).password;
    expect(after).toBe(before);
  });

  it('re-hashes when the password is changed', async () => {
    const user = await User.create(resident);
    const loaded = await User.findById(user._id).select('+password');
    loaded.password = 'a-new-password-1';
    await loaded.save();

    const after = await User.findById(user._id).select('+password');
    expect(after.password).toMatch(/^\$2b\$12\$/);
    expect(await after.comparePassword('a-new-password-1')).toBe(true);
    expect(await after.comparePassword(resident.password)).toBe(false);
  });

  it('never returns the password from queries or JSON', async () => {
    const user = await User.create(resident);
    expect(user.toJSON().password).toBeUndefined();
    const found = await User.findById(user._id);
    expect(found.password).toBeUndefined();
  });

  it('rejects a password shorter than 8 characters', async () => {
    await expect(User.create({ ...resident, password: 'short' })).rejects.toThrow(/at least 8/);
  });

  it('rejects an unknown role', async () => {
    await expect(User.create({ ...resident, role: 'superuser' })).rejects.toThrow(/Role must be one of/);
  });

  it('rejects a duplicate email, ignoring case', async () => {
    await User.create(resident);
    await expect(User.create({ ...resident, email: 'ASHA@example.com' })).rejects.toMatchObject({ code: 11000 });
  });
});

describe('POST /api/auth/login (FR-02)', () => {
  beforeEach(async () => {
    await User.create(resident);
  });

  it('logs in with valid credentials and returns a token and the user', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: resident.email,
      password: resident.password,
    });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(resident.email);
    expect(res.body.user.role).toBe('resident');
    expect(res.body.user.password).toBeUndefined();

    const payload = jwt.verify(res.body.token, 'test-secret');
    expect(payload.sub).toBe(res.body.user._id);
    expect(payload.role).toBe('resident');
    expect(payload.exp - payload.iat).toBe(30 * 60); // NFR-05: 30-minute session
  });

  it('accepts the email in any case and with surrounding spaces', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: '  ASHA@Example.com ',
      password: resident.password,
    });
    expect(res.status).toBe(200);
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: resident.email,
      password: 'not-the-password',
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.token).toBeUndefined();
  });

  it('gives the same answer for an unknown email as for a wrong password', async () => {
    const wrongPassword = await request(app).post('/api/auth/login').send({
      email: resident.email,
      password: 'not-the-password',
    });
    const unknownEmail = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'whatever-123',
    });
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it('requires an email', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: resident.password });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('email');
  });

  it('requires a password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: resident.email });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('password');
  });

  it('rejects a query object instead of an email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: { $gt: '' },
      password: resident.password,
    });
    expect(res.status).toBe(400);
  });

  it('refuses to log in a deactivated account with 403', async () => {
    await User.updateOne({ email: resident.email }, { isActive: false });
    const res = await request(app).post('/api/auth/login').send({
      email: resident.email,
      password: resident.password,
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });
});
