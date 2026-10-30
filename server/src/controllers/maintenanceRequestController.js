const MaintenanceRequest = require('../models/MaintenanceRequest');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const { CATEGORIES, PRIORITIES } = MaintenanceRequest;

function readString(body, field) {
  return typeof body[field] === 'string' ? body[field].trim() : '';
}

/**
 * POST /api/maintenance-requests (FR-04, UC-04)
 * A resident raises a request. It is always saved with status Open.
 */
const createMaintenanceRequest = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const category = readString(body, 'category');
  const description = readString(body, 'description');
  const priority = readString(body, 'priority');

  if (!category) throw new ApiError(400, 'VALIDATION_ERROR', 'Category is required.', 'category');
  if (!CATEGORIES.includes(category)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Category must be one of: ${CATEGORIES.join(', ')}.`, 'category');
  }
  if (!description) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Description is required.', 'description');
  }
  if (description.length > 2000) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Description can be at most 2000 characters.', 'description');
  }
  if (!priority) throw new ApiError(400, 'VALIDATION_ERROR', 'Priority is required.', 'priority');
  if (!PRIORITIES.includes(priority)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Priority must be one of: ${PRIORITIES.join(', ')}.`, 'priority');
  }

  const request = await MaintenanceRequest.create({
    resident: req.user._id,
    category,
    description,
    priority,
    // Status is server-controlled; any status sent by the client is ignored.
    status: 'Open',
  });

  res.status(201).json({
    message: 'Maintenance request submitted successfully.',
    request,
  });
});

/**
 * GET /api/maintenance-requests
 * Residents see only their own requests; admin and maintenance staff see all.
 */
const listMaintenanceRequests = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'resident' ? { resident: req.user._id } : {};
  const requests = await MaintenanceRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate('resident', 'name email')
    .lean();
  res.json({ count: requests.length, requests });
});

module.exports = { createMaintenanceRequest, listMaintenanceRequests };
