const request = require('supertest');
const express = require('express');

process.env.NODE_ENV = 'test';
const app = require('../src/app');
const errorHandler = require('../src/middleware/errorHandler');
const ApiError = require('../src/utils/ApiError');
const asyncHandler = require('../src/utils/asyncHandler');

describe('GET /api/health', () => {
  it('returns status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('resitrack-api');
    expect(res.body).toHaveProperty('database');
  });
});

describe('unknown routes', () => {
  it('return 404 in the standard error format', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('error handler', () => {
  // A tiny app that throws different errors, to check each is mapped correctly
  const testApp = express();
  testApp.use(express.json());
  testApp.get('/api-error', () => {
    throw new ApiError(403, 'FORBIDDEN', 'Not allowed', 'role');
  });
  testApp.get('/validation', () => {
    const err = new Error('invalid');
    err.name = 'ValidationError';
    err.errors = { email: { message: 'Email is required' } };
    throw err;
  });
  testApp.get('/duplicate', () => {
    const err = new Error('dup');
    err.code = 11000;
    err.keyValue = { email: 'a@b.com' };
    throw err;
  });
  testApp.get('/async', asyncHandler(async () => {
    throw new ApiError(400, 'BAD_REQUEST', 'Bad input');
  }));
  testApp.get('/crash', () => {
    throw new Error('database password leaked here');
  });
  testApp.post('/json', (req, res) => res.json(req.body));
  testApp.use(errorHandler);

  it('maps ApiError to its status, code and field', async () => {
    const res = await request(testApp).get('/api-error');
    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({ code: 'FORBIDDEN', message: 'Not allowed', field: 'role' });
  });

  it('maps validation errors to 400 with the field name', async () => {
    const res = await request(testApp).get('/validation');
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('email');
  });

  it('maps duplicate keys to 409', async () => {
    const res = await request(testApp).get('/duplicate');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE');
  });

  it('passes async errors to the handler', async () => {
    const res = await request(testApp).get('/async');
    expect(res.status).toBe(400);
  });

  it('hides internal details on 500', async () => {
    const res = await request(testApp).get('/crash');
    expect(res.status).toBe(500);
    expect(res.body.error.message).not.toMatch(/password/);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(testApp)
      .post('/json')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});
