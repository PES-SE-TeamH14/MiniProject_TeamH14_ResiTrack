
const {
  createSessionTimeout,
  DEFAULT_IDLE_TIMEOUT_MS,
} = require('../src/middleware/sessionTimeout');

describe('session timeout middleware', () => {
  const now = Date.parse('2026-10-20T10:00:00.000Z');
  let middleware;
  let next;

  beforeEach(() => {
    middleware = createSessionTimeout({ now: () => now });
    next = jest.fn();
  });

  it('uses a 30-minute default timeout', () => {
    expect(DEFAULT_IDLE_TIMEOUT_MS).toBe(30 * 60 * 1000);
  });

  it('allows a request with recent activity', () => {
    const req = {
      auth: { lastActivityAt: now - 5 * 60 * 1000 },
    };

    middleware(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects activity at exactly 30 minutes with SESSION_EXPIRED', () => {
    const req = {
      auth: { lastActivityAt: now - 30 * 60 * 1000 },
    };

    middleware(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error.status).toBe(401);
    expect(error.code).toBe('SESSION_EXPIRED');
  });

  it('rejects activity older than 30 minutes', () => {
    const req = {
      auth: { lastActivityAt: now - 31 * 60 * 1000 },
    };

    middleware(req, {}, next);

    expect(next.mock.calls[0][0].code).toBe('SESSION_EXPIRED');
  });

  it('leaves requests without authentication metadata to auth middleware', () => {
    middleware({}, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects an invalid activity timestamp', () => {
    const req = {
      auth: { lastActivityAt: 'not-a-date' },
    };

    middleware(req, {}, next);

    expect(next.mock.calls[0][0].code).toBe('SESSION_EXPIRED');
  });

  it('rejects invalid timeout configuration', () => {
    expect(() => createSessionTimeout({ idleTimeoutMs: 0 })).toThrow(
      'idleTimeoutMs must be a positive number.',
    );
  });
});
