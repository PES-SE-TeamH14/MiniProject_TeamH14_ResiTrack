const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const Flat = require('../models/Flat');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { recordAuditLog } = require('../utils/auditLogger');

const CONTACT_FIELDS = ['name', 'email', 'phone', 'leaseStart', 'leaseEnd'];
const FLAT_SUMMARY = 'flatNumber block floor type monthlyRent';

function pick(body, fields) {
  const out = {};
  for (const field of fields) {
    if (body[field] !== undefined) out[field] = body[field];
  }
  return out;
}

/**
 * POST /api/tenants — Admin. Register a tenant and assign a flat (FR-01, UC-01).
 * Only an active, vacant flat can be assigned (FR-12).
 */
const createTenant = asyncHandler(async (req, res) => {
  const { flat: flatId } = req.body;
  if (flatId !== undefined && !mongoose.isValidObjectId(flatId)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Select a valid flat.', 'flat');
  }

  // 1. Check the tenant's own fields first (name, email, phone, dates, flat given)
  const tenant = new Tenant({ ...pick(req.body, CONTACT_FIELDS), flat: flatId });
  await tenant.validate();

  // 2. Check the flat exists and is active
  const flat = await Flat.findById(flatId);
  if (!flat) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Selected flat does not exist.', 'flat');
  }
  if (!flat.isActive) {
    throw new ApiError(409, 'FLAT_INACTIVE', `Flat ${flat.flatNumber} is deactivated and cannot be assigned.`, 'flat');
  }

  // 3. Claim the flat atomically, so two registrations cannot take the same flat
  const claimed = await Flat.findOneAndUpdate(
    { _id: flat._id, isActive: true, isOccupied: false },
    { isOccupied: true },
    { new: true },
  );
  if (!claimed) {
    throw new ApiError(409, 'FLAT_OCCUPIED', `Flat ${flat.flatNumber} is already occupied.`, 'flat');
  }

  // 4. Save the tenant; if that fails (e.g. duplicate email), release the flat again
  try {
    await tenant.save();
  } catch (err) {
    await Flat.updateOne({ _id: flat._id }, { isOccupied: false });
    throw err;
  }

    await tenant.populate('flat', FLAT_SUMMARY);

    await recordAuditLog({
      actorId: req.user._id,
      action: 'TENANT_CREATED',
      resourceType: 'Tenant',
      resourceId: tenant._id,
    });

    res.status(201).json({ tenant });
});

/**
 * GET /api/tenants?status=current|past|all — Admin.
 */
const listTenants = asyncHandler(async (req, res) => {
  const { status = 'current' } = req.query;
  const filter = {};
  if (status === 'current') filter.isActive = true;
  else if (status === 'past') filter.isActive = false;
  else if (status !== 'all') {
    throw new ApiError(400, 'INVALID_QUERY', 'status must be current, past or all.', 'status');
  }

  const tenants = await Tenant.find(filter).populate('flat', FLAT_SUMMARY).sort({ name: 1 });
  res.json({ count: tenants.length, tenants });
});

/**
 * GET /api/tenants/:id — Admin.
 */
const getTenant = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.params.id).populate('flat', FLAT_SUMMARY);
  if (!tenant) throw new ApiError(404, 'NOT_FOUND', 'Tenant not found.');
  res.json({ tenant });
});

/**
 * PATCH /api/tenants/:id — Admin. Edit contact details or lease dates.
 * The flat cannot be changed here: move the tenant out and register again.
 */
const updateTenant = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.params.id);
  if (!tenant) throw new ApiError(404, 'NOT_FOUND', 'Tenant not found.');

    Object.assign(tenant, pick(req.body, CONTACT_FIELDS));
    await tenant.save();
    await tenant.populate('flat', FLAT_SUMMARY);

    await recordAuditLog({
      actorId: req.user._id,
      action: 'TENANT_UPDATED',
      resourceType: 'Tenant',
      resourceId: tenant._id,
    });

    res.json({ tenant });
});

/**
 * POST /api/tenants/:id/move-out — Admin. End the tenancy and free the flat.
 */
const moveOutTenant = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.params.id);
  if (!tenant) throw new ApiError(404, 'NOT_FOUND', 'Tenant not found.');
  if (!tenant.isActive) {
    throw new ApiError(409, 'ALREADY_MOVED_OUT', 'This tenant has already moved out.');
  }

  tenant.isActive = false;
  tenant.movedOutAt = new Date();
  await tenant.save();
  await Flat.updateOne({ _id: tenant.flat }, { isOccupied: false });

  await tenant.populate('flat', FLAT_SUMMARY);

  await recordAuditLog({
    actorId: req.user._id,
    action: 'TENANT_MOVED_OUT',
    resourceType: 'Tenant',
    resourceId: tenant._id,
  });

  res.json({ tenant });
});

module.exports = { createTenant, listTenants, getTenant, updateTenant, moveOutTenant };
