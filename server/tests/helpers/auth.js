const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');
const { signToken } = require('../../src/utils/token');

// Tests sign real tokens, so they need a secret
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Hashing at cost 12 is deliberately slow, so test users share one pre-computed hash
let passwordHash;
let counter = 0;

/**
 * Creates a user with the given role and returns { user, token, header }.
 * Call it in beforeEach, because db.clear() removes users after every test.
 */
async function loginAs(role = 'admin', overrides = {}) {
  passwordHash = passwordHash || (await bcrypt.hash('test-password-1', 12));
  counter += 1;
  const { insertedId } = await User.collection.insertOne({
    name: `Test ${role}`,
    email: `${role}${counter}@test.local`,
    password: passwordHash,
    role,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  const user = await User.findById(insertedId);
  const token = signToken(user);
  return { user, token, header: `Bearer ${token}` };
}

/**
 * A supertest wrapper that sends the Authorization header on every call:
 *   const api = as(app, admin.header);
 *   await api.post('/api/flats').send(sample);
 */
function as(app, header) {
  // required lazily so this helper can be loaded before NODE_ENV is set
  const request = require('supertest');
  const call = (method) => (url) => request(app)[method](url).set('Authorization', header);
  return { get: call('get'), post: call('post'), patch: call('patch'), put: call('put'), delete: call('delete') };
}

module.exports = { loginAs, as };
