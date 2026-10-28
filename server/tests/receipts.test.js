process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const Flat = require('../src/models/Flat');
const Tenant = require('../src/models/Tenant');
const Payment = require('../src/models/Payment');
const AuditLog = require('../src/models/AuditLog');
const { SimplePdf, escapeText } = require('../src/utils/simplePdf');
const db = require('./helpers/db');
const { loginAs, as } = require('./helpers/auth');

let admin;
let api;
let ravi;
let meera;
let raviPayment;
let meeraPayment;

beforeAll(async () => {
  await db.connect();
  await Promise.all([Flat.init(), Tenant.init(), Payment.init()]);
});

beforeEach(async () => {
  admin = await loginAs('admin');
  api = as(app, admin.header);

  const [flatA, flatB] = await Flat.create([
    { flatNumber: 'A-101', block: 'A', monthlyRent: 18000, isOccupied: true },
    { flatNumber: 'B-201', block: 'B', monthlyRent: 25000, isOccupied: true },
  ]);
  [ravi, meera] = await Tenant.create([
    {
      name: 'Ravi Kumar',
      email: 'ravi@example.com',
      phone: '9876543210',
      flat: flatA._id,
      leaseStart: '2026-01-01',
      leaseEnd: '2026-12-31',
    },
    {
      name: 'Meera Nair',
      email: 'meera@example.com',
      phone: '9123456780',
      flat: flatB._id,
      leaseStart: '2026-06-01',
      leaseEnd: '2027-05-31',
    },
  ]);
  [raviPayment, meeraPayment] = await Payment.create([
    { tenant: ravi._id, flat: flatA._id, month: '2026-10', amount: 18000, paidOn: '2026-10-02', method: 'UPI', reference: 'UTR123' },
    { tenant: meera._id, flat: flatB._id, month: '2026-10', amount: 25000, paidOn: '2026-10-03', method: 'Cash' },
  ]);
});

afterEach(() => db.clear());
afterAll(() => db.close());

// Reads the response body as raw bytes
const asBuffer = (res, callback) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};
const downloadReceipt = (client, id) => client.get(`/api/payments/${id}/receipt`).buffer(true).parse(asBuffer);

describe('GET /api/payments/:id/receipt (FR-15, TC-15)', () => {
  it('lets the admin download a PDF with tenant name, flat, amount and date', async () => {
    const res = await downloadReceipt(api, raviPayment._id);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toBe('attachment; filename="receipt-A-101-2026-10.pdf"');

    const pdf = res.body.toString('latin1');
    expect(pdf.startsWith('%PDF-')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pdf).toContain('(Ravi Kumar)');
    expect(pdf).toContain('(Block A, Flat A-101)');
    expect(pdf).toContain('(Rs. 18,000.00)');
    expect(pdf).toContain('(02 Oct 2026)');
    expect(pdf).toContain('(October 2026)');
    expect(pdf).toContain('(UTR123)');
    expect(pdf).toContain(`RCPT-202610-${String(raviPayment._id).slice(-6).toUpperCase()}`);
  });

  it('produces a well-formed PDF (the cross-reference table points at the right bytes)', async () => {
    const res = await downloadReceipt(api, raviPayment._id);
    const pdf = res.body.toString('latin1');

    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(pdf)[1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe('xref');

    const entries = [...pdf.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(6);
    entries.forEach((offset, i) => {
      expect(pdf.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
  });

  it('writes an audit log entry for the download', async () => {
    await downloadReceipt(api, raviPayment._id);

    const log = await AuditLog.findOne({ action: 'RECEIPT_DOWNLOADED' });
    expect(log).not.toBeNull();
    expect(String(log.actorId)).toBe(String(admin.user._id));
    expect(log.resourceId).toBe(String(raviPayment._id));
  });

  it('returns 404 for an unknown or invalid payment id', async () => {
    const unknown = await api.get('/api/payments/64b7f0c2a1b2c3d4e5f60718/receipt');
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');

    const invalid = await api.get('/api/payments/not-an-id/receipt');
    expect(invalid.status).toBe(404);
  });

  it('lets a resident download their own receipt', async () => {
    const resident = await loginAs('resident', { email: 'ravi@example.com' });
    const res = await downloadReceipt(as(app, resident.header), raviPayment._id);

    expect(res.status).toBe(200);
    expect(res.body.toString('latin1')).toContain('(Ravi Kumar)');
  });

  it("returns 404 when a resident asks for someone else's receipt", async () => {
    const resident = await loginAs('resident', { email: 'ravi@example.com' });
    const res = await as(app, resident.header).get(`/api/payments/${meeraPayment._id}/receipt`);

    expect(res.status).toBe(404);
    expect(await AuditLog.countDocuments({ action: 'RECEIPT_DOWNLOADED' })).toBe(0);
  });

  it('needs a login', async () => {
    const res = await request(app).get(`/api/payments/${raviPayment._id}/receipt`);
    expect(res.status).toBe(401);
  });

  it.each(['maintenance', 'owner'])('is forbidden for the %s role', async (role) => {
    const user = await loginAs(role);
    const res = await as(app, user.header).get(`/api/payments/${raviPayment._id}/receipt`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('GET /api/payments/mine', () => {
  it("lists only the resident's own payments", async () => {
    const resident = await loginAs('resident', { email: 'meera@example.com' });
    const res = await as(app, resident.header).get('/api/payments/mine');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.payments[0]).toMatchObject({ month: '2026-10', amount: 25000 });
    expect(res.body.payments[0].flat.flatNumber).toBe('B-201');
  });

  it('is empty for a resident with no tenant record', async () => {
    const resident = await loginAs('resident', { email: 'stranger@example.com' });
    const res = await as(app, resident.header).get('/api/payments/mine');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });

  it('is forbidden for the admin and needs a login', async () => {
    expect((await api.get('/api/payments/mine')).status).toBe(403);
    expect((await request(app).get('/api/payments/mine')).status).toBe(401);
  });
});

describe('other payment routes stay Admin only', () => {
  it('forbids a resident from listing payments or opening one', async () => {
    const resident = await loginAs('resident', { email: 'ravi@example.com' });
    const client = as(app, resident.header);
    expect((await client.get('/api/payments')).status).toBe(403);
    expect((await client.get(`/api/payments/${raviPayment._id}`)).status).toBe(403);
  });
});

describe('SimplePdf', () => {
  it('escapes brackets and backslashes, and replaces characters it cannot print', () => {
    expect(escapeText('A(B)\\C')).toBe('A\\(B\\)\\\\C');
    expect(escapeText('café ₹')).toBe('caf? ?');
  });

  it('writes text, lines and boxes into the page', () => {
    const pdf = new SimplePdf().text(10, 20, 'Hello', { bold: true }).line(0, 0, 5, 5).rect(1, 2, 3, 4).rect(1, 2, 3, 4, { fill: 0.9 });
    const out = pdf.toBuffer().toString('latin1');
    expect(out).toContain('/F2 12 Tf 10 20 Td (Hello) Tj');
    expect(out).toContain('0 0 m 5 5 l S');
    expect(out).toContain('1 2 3 4 re S');
    expect(out).toContain('0.9 g 1 2 3 4 re f');
  });
});
