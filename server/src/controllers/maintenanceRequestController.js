const mongoose = require('mongoose');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { recordAuditLog } = require('../utils/auditLogger');

const { CATEGORIES, PRIORITIES, STATUSES } = MaintenanceRequest;

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
 * GET /api/maintenance-requests[?status=Open]
 * Residents see only their own requests; admin and maintenance staff see all.
 * The optional status filter serves the FR-09 Kanban board (SAD §3.2 "List/filter").
 */
const listMaintenanceRequests = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'resident' ? { resident: req.user._id } : {};
  if (req.query.status !== undefined) {
    if (!STATUSES.includes(req.query.status)) {
      throw new ApiError(400, 'INVALID_STATUS', `Status must be one of: ${STATUSES.join(', ')}.`, 'status');
    }
    filter.status = req.query.status;
  }
  const requests = await MaintenanceRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate('resident', 'name email')
    .lean();
  res.json({ count: requests.length, requests });
});

/**
 * PATCH /api/maintenance-requests/:id (FR-05, UC-05)
 * Maintenance staff (and admin, from the FR-09 Kanban board) move a request
 * between Open, In Progress and Resolved. Only the status can be changed here.
 */
const updateMaintenanceRequestStatus = asyncHandler(async (req, res) => {
  const status = readString(req.body || {}, 'status');

  if (!STATUSES.includes(status)) {
    throw new ApiError(400, 'INVALID_STATUS', `Status must be one of: ${STATUSES.join(', ')}.`, 'status');
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(404, 'NOT_FOUND', 'Maintenance request not found.');
  }

  const request = await MaintenanceRequest.findById(req.params.id);
  if (!request) {
    throw new ApiError(404, 'NOT_FOUND', 'Maintenance request not found.');
  }
  if (request.status === status) {
    throw new ApiError(400, 'STATUS_UNCHANGED', 'The request already has this status.', 'status');
  }

  const previousStatus = request.status;
  request.status = status;
  request.statusHistory.push({ status, changedAt: new Date(), changedBy: req.user._id });
  await request.save();

  // Only audit status changes performed by an administrator (same rule as complaints).
  if (req.user.role === 'admin') {
    await recordAuditLog({
      actorId: req.user._id,
      action: 'MAINTENANCE_STATUS_UPDATED',
      resourceType: 'MaintenanceRequest',
      resourceId: request._id,
      metadata: { from: previousStatus, to: status },
    });
  }

  res.json({
    message: `Request status updated to ${status}.`,
    request,
  });
});

module.exports = {
  createMaintenanceRequest,
  listMaintenanceRequests,
  updateMaintenanceRequestStatus,
};
