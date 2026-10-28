const Flat = require('../models/Flat');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { recordAuditLog } = require('../utils/auditLogger');

// Only these fields can be set through the API. isOccupied is managed by tenant assignment (#8).
const CREATE_FIELDS = ['flatNumber', 'block', 'floor', 'type', 'monthlyRent'];
const UPDATE_FIELDS = [...CREATE_FIELDS, 'isActive'];

function pick(body, fields) {
  const out = {};
  for (const field of fields) {
    if (body[field] !== undefined) out[field] = body[field];
  }
  return out;
}

/**
 * POST /api/flats — Admin. Add a flat (FR-12).
 */
const createFlat = asyncHandler(async (req, res) => {
  const flat = await Flat.create(pick(req.body, CREATE_FIELDS));

  await recordAuditLog({
    actorId: req.user._id,
    action: 'FLAT_CREATED',
    resourceType: 'Flat',
    resourceId: flat._id,
  });

  res.status(201).json({ flat });
});

/**
 * GET /api/flats?status=all|active|inactive&available=true — Admin.
 * available=true returns only active, unoccupied flats (used when assigning a tenant).
 */
const listFlats = asyncHandler(async (req, res) => {
  const { status = 'all', available } = req.query;
  const filter = {};

  if (status === 'active') filter.isActive = true;
  else if (status === 'inactive') filter.isActive = false;
  else if (status !== 'all') {
    throw new ApiError(400, 'INVALID_QUERY', 'status must be all, active or inactive.', 'status');
  }

  if (available === 'true') {
    filter.isActive = true;
    filter.isOccupied = false;
  }

  const flats = await Flat.find(filter).sort({ block: 1, flatNumber: 1 }).lean();
  res.json({ count: flats.length, flats });
});

/**
 * GET /api/flats/:id — Admin.
 */
const getFlat = asyncHandler(async (req, res) => {
  const flat = await Flat.findById(req.params.id);
  if (!flat) throw new ApiError(404, 'NOT_FOUND', 'Flat not found.');
  res.json({ flat });
});

/**
 * PATCH /api/flats/:id — Admin. Edit, deactivate or reactivate a flat (FR-12).
 * An occupied flat cannot be deactivated.
 */
const updateFlat = asyncHandler(async (req, res) => {
  const flat = await Flat.findById(req.params.id);
  if (!flat) throw new ApiError(404, 'NOT_FOUND', 'Flat not found.');

  const updates = pick(req.body, UPDATE_FIELDS);
  if (updates.isActive === false && flat.isOccupied) {
    throw new ApiError(
      409,
      'FLAT_OCCUPIED',
      'Cannot deactivate an occupied flat. Move the tenant out first.',
      'isActive',
    );
  }

  Object.assign(flat, updates);
  await flat.save();

  await recordAuditLog({
    actorId: req.user._id,
    action: 'FLAT_UPDATED',
    resourceType: 'Flat',
    resourceId: flat._id,
  });

  res.json({ flat });
});

module.exports = { createFlat, listFlats, getFlat, updateFlat };
