const path = require('path');
const mongoose = require('mongoose');
const Document = require('../models/Document');
const Tenant = require('../models/Tenant');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { recordAuditLog } = require('../utils/auditLogger');

// Keep only the file name (no folders) and drop characters that are unsafe in headers
function cleanFileName(name) {
  const base = Array.from(path.basename(String(name || 'document')))
    .map((char) => (char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || '"\\/'.includes(char) ? '_' : char))
    .join('');
  return base.slice(0, 200) || 'document';
}

/**
 * POST /api/documents — Admin. Upload a lease agreement or ID proof for a tenant (FR-11, UC-11).
 * multipart/form-data fields: file (PDF/JPEG, at most 5 MB), tenant (tenant id), docType.
 * The file has already been checked by the upload middleware.
 */
const uploadDocument = asyncHandler(async (req, res) => {
  const { tenant: tenantId, docType } = req.body;

  if (!mongoose.isValidObjectId(tenantId)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Select a valid tenant.', 'tenant');
  }
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    throw new ApiError(404, 'NOT_FOUND', 'Tenant not found.', 'tenant');
  }

  const document = await Document.create({
    tenant: tenant._id,
    docType,
    originalName: cleanFileName(req.file.originalname),
    mimeType: req.file.detectedType,
    size: req.file.size,
    data: req.file.buffer,
    uploadedBy: req.user._id,
  });

  await recordAuditLog({
    actorId: req.user._id,
    action: 'DOCUMENT_UPLOADED',
    resourceType: 'Document',
    resourceId: document._id,
    metadata: { tenant: String(tenant._id), docType: document.docType },
  });

  res.status(201).json({ document });
});

/**
 * GET /api/documents?tenant=<id> — Admin. List documents (without file contents), newest first.
 */
const listDocuments = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.tenant !== undefined) {
    if (!mongoose.isValidObjectId(req.query.tenant)) {
      throw new ApiError(400, 'INVALID_QUERY', 'tenant must be a valid tenant id.', 'tenant');
    }
    filter.tenant = req.query.tenant;
  }

  const documents = await Document.find(filter)
    .sort({ createdAt: -1 })
    .populate('tenant', 'name email')
    .populate('uploadedBy', 'name');
  res.json({ count: documents.length, documents });
});

/**
 * GET /api/documents/:id/file — Admin. Download the stored file.
 */
const downloadDocument = asyncHandler(async (req, res) => {
  const document = await Document.findById(req.params.id).select('+data');
  if (!document) throw new ApiError(404, 'NOT_FOUND', 'Document not found.');

  res.set('Content-Type', document.mimeType);
  res.set('Content-Length', String(document.data.length));
  res.attachment(document.originalName);
  res.send(document.data);
});

module.exports = { uploadDocument, listDocuments, downloadDocument };
