const request = require('supertest');
const express = require('express');

process.env.NODE_ENV = 'test';
const enforceHttps = require('../src/middleware/enforceHttps');
const errorHandler = require('../src/middleware/errorHandler');

// NFR-04 / SEC-02 (#19, TC-NFR-04): plain HTTP is rejected or redirected, HTTPS is served with HSTS.

function buildApp(options) {
  const app = express();
  app.set('trust proxy', 1); // as behind Render: X-Forwarded-Proto tells us what the browser used
  app.use(enforceHttps(options));
  app.get('/api/tenants', (_req, res) => res.json({ ok: true }));
  app.post('/api/auth/login', (_req, res) => res.json({ ok: true }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use(errorHandler);
  return app;
}

describe('enforceHttps middleware (enabled)', () => {
  const app = buildApp({ enabled: true });

  it('redirects a plain HTTP GET to the same URL on HTTPS (308)', async () => {
    const res = await request(app).get('/api/tenants?page=2').set('Host', 'api.example.com');
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe('https://api.example.com/api/tenants?page=2');
  });

  it('rejects a plain HTTP POST with 426 and the standard error body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Host', 'api.example.com')
      .send({ email: 'a@b.com', password: 'secret' });
    expect(res.status).toBe(426);
    expect(res.body.error.code).toBe('HTTPS_REQUIRED');
  });

  it('serves requests that arrived over HTTPS (X-Forwarded-Proto: https)', async () => {
    const res = await request(app).get('/api/tenants').set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('serves a POST that arrived over HTTPS', async () => {
    const res = await request(app).post('/api/auth/login').set('X-Forwarded-Proto', 'https').send({});
    expect(res.status).toBe(200);
  });

  it('keeps /api/health reachable over HTTP for platform health checks', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('uses the fixed HTTPS_HOST for the redirect when one is configured', async () => {
    const fixed = buildApp({ enabled: true, host: 'resitrack-api.onrender.com' });
    const res = await request(fixed).get('/api/tenants').set('Host', 'evil.example.net');
    expect(res.headers.location).toBe('https://resitrack-api.onrender.com/api/tenants');
  });
});

describe('enforceHttps middleware (disabled, local development)', () => {
  it('lets plain HTTP through', async () => {
    const res = await request(buildApp({ enabled: false })).get('/api/tenants');
    expect(res.status).toBe(200);
  });
});

describe('the real app with FORCE_HTTPS=true TRUST_PROXY=1', () => {
  let app;

  beforeAll(() => {
    jest.resetModules();
    process.env.FORCE_HTTPS = 'true';
    process.env.TRUST_PROXY = '1';
    app = require('../src/app');
  });

  afterAll(() => {
    delete process.env.FORCE_HTTPS;
    delete process.env.TRUST_PROXY;
    jest.resetModules();
  });

  it('redirects plain HTTP API calls to HTTPS', async () => {
    const res = await request(app).get('/api/tenants').set('Host', 'api.example.com');
    expect(res.status).toBe(308);
    expect(res.headers.location).toMatch(/^https:\/\/api\.example\.com\/api\/tenants/);
  });

  it('rejects plain HTTP logins', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'x' });
    expect(res.status).toBe(426);
  });

  it('sends Strict-Transport-Security on HTTPS responses', async () => {
    const res = await request(app).get('/api/health').set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(200);
    expect(res.headers['strict-transport-security']).toMatch(/max-age=31536000/);
    expect(res.headers['strict-transport-security']).toMatch(/includeSubDomains/);
  });
});
