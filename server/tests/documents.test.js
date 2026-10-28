process.env.NODE_ENV = 'test';

const app = require('../src/app');
const Flat = require('../src/models/Flat');
const Tenant = require('../src/models/Tenant');
const Document = require('../src/models/Document');
const AuditLog = require('../src/models/AuditLog');
const db = require('./helpers/db');
const { loginAs, as } = require('./helpers/auth');

const MB = 1024 * 1024;

// Small but real file signatures: PDFs start with "%PDF-", JPEGs with FF D8 FF
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('lease agreement for A-101\n%%EOF\n')]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

// A buffer of `size` bytes that starts like a PDF
function pdfOfSize(size) {
  const buffer = Buffer.alloc(size, 0x20);
  PDF.copy(buffer, 0, 0, Math.min(PDF.length, size));
  return buffer;
}

let api;
let tenant;

beforeAll(() => db.connect());

beforeEach(async () => {
  const admin = await loginAs('admin');
  api = as(app, admin.header);
  const flat = await Flat.create({ flatNumber: 'A-101', monthlyRent: 18000, isOccupied: true });
  tenant = await Tenant.create({
    name: 'Asha Rao',
    email: 'asha@example.com',
    phone: '9876543210',
    flat: flat._id,
    leaseStart: new Date('2026-01-01'),
    leaseEnd: new Date('2027-01-01'),
  });
});

afterEach(() => db.clear());
afterAll(() => db.close());

function upload(buffer, filename, contentType, fields = {}) {
  const req = api
    .post('/api/documents')
    .field('tenant', fields.tenant ?? String(tenant._id))
    .field('docType', fields.docType ?? 'Lease agreement');
  return buffer ? req.attach('file', buffer, { filename, contentType }) : req;
}

describe('POST /api/documents (FR-11, TC-11)', () => {
  it('accepts a PDF, stores it and returns the record without the file contents', async () => {
    const res = await upload(PDF, 'lease.pdf', 'application/pdf');
    expect(res.status).toBe(201);
    expect(res.body.document).toMatchObject({
      tenant: String(tenant._id),
      docType: 'Lease agreement',
      originalName: 'lease.pdf',
      mimeType: 'application/pdf',
      size: PDF.length,
    });
    expect(res.body.document.data).toBeUndefined();

    const saved = await Document.findById(res.body.document._id).select('+data');
    expect(Buffer.compare(saved.data, PDF)).toBe(0);
  });

  it('accepts a JPEG ID proof', async () => {
    const res = await upload(JPEG, 'aadhaar.jpg', 'image/jpeg', { docType: 'ID proof' });
    expect(res.status).toBe(201);
    expect(res.body.document.mimeType).toBe('image/jpeg');
    expect(res.body.document.docType).toBe('ID proof');
  });

  it('accepts a file of exactly 5 MB', async () => {
    const res = await upload(pdfOfSize(5 * MB), 'big-lease.pdf', 'application/pdf');
    expect(res.status).toBe(201);
    expect(res.body.document.size).toBe(5 * MB);
  });

  it('rejects a file over 5 MB with 413 and stores nothing', async () => {
    const res = await upload(pdfOfSize(5 * MB + 1), 'too-big.pdf', 'application/pdf');
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    expect(await Document.countDocuments()).toBe(0);
  });

  it('rejects other file types with 415 and stores nothing', async () => {
    const res = await upload(PNG, 'photo.png', 'image/png');
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    expect(await Document.countDocuments()).toBe(0);
  });

  it('checks the file contents, not the name or the claimed type', async () => {
    const fake = Buffer.from('just some text pretending to be a PDF');
    const res = await upload(fake, 'lease.pdf', 'application/pdf');
    expect(res.status).toBe(415);
    expect(await Document.countDocuments()).toBe(0);
  });

  it('requires a file', async () => {
    const res = await upload(null);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FILE_REQUIRED');
  });

  it('requires a valid document type', async () => {
    const res = await upload(PDF, 'lease.pdf', 'application/pdf', { docType: 'Selfie' });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe('docType');
    expect(await Document.countDocuments()).toBe(0);
  });

  it('requires a valid, existing tenant', async () => {
    const invalid = await upload(PDF, 'lease.pdf', 'application/pdf', { tenant: 'not-an-id' });
    const missing = await upload(PDF, 'lease.pdf', 'application/pdf', { tenant: '64b000000000000000000000' });
    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
    expect(await Document.countDocuments()).toBe(0);
  });

  it('keeps only the file name, without folders', async () => {
    const res = await upload(PDF, '../../etc/lease.pdf', 'application/pdf');
    expect(res.status).toBe(201);
    expect(res.body.document.originalName).toBe('lease.pdf');
  });

  it('records the upload in the audit log (NFR-10)', async () => {
    const res = await upload(PDF, 'lease.pdf', 'application/pdf');
    const log = await AuditLog.findOne({ action: 'DOCUMENT_UPLOADED' });
    expect(log).not.toBeNull();
    expect(log.resourceId).toBe(res.body.document._id);
  });

  it('refuses non-admin users before reading the upload', async () => {
    const resident = await loginAs('resident');
    const res = await as(app, resident.header)
      .post('/api/documents')
      .field('tenant', String(tenant._id))
      .field('docType', 'Lease agreement')
      .attach('file', PDF, { filename: 'lease.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(403);
    expect(await Document.countDocuments()).toBe(0);
  });
});

describe('GET /api/documents', () => {
  it('lists documents newest first, without file contents', async () => {
    await upload(PDF, 'lease.pdf', 'application/pdf');
    await upload(JPEG, 'id.jpg', 'image/jpeg', { docType: 'ID proof' });

    const res = await api.get('/api/documents');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.documents.map((d) => d.originalName)).toEqual(['id.jpg', 'lease.pdf']);
    expect(res.body.documents[0].tenant.name).toBe('Asha Rao');
    expect(res.body.documents.every((d) => d.data === undefined)).toBe(true);
  });

  it('filters by tenant', async () => {
    await upload(PDF, 'lease.pdf', 'application/pdf');
    const other = await api.get('/api/documents').query({ tenant: '64b000000000000000000000' });
    const mine = await api.get('/api/documents').query({ tenant: String(tenant._id) });
    expect(other.body.count).toBe(0);
    expect(mine.body.count).toBe(1);
  });

  it('rejects an invalid tenant filter', async () => {
    const res = await api.get('/api/documents').query({ tenant: 'nope' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/documents/:id/file', () => {
  it('returns the exact stored file with its type and name', async () => {
    const uploaded = await upload(PDF, 'lease.pdf', 'application/pdf');
    const res = await api
      .get(`/api/documents/${uploaded.body.document._id}/file`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="lease.pdf"/);
    expect(Buffer.compare(res.body, PDF)).toBe(0);
  });

  it('returns 404 for an unknown document', async () => {
    const res = await api.get('/api/documents/64b000000000000000000000/file');
    expect(res.status).toBe(404);
  });
});
