
const Complaint = require('../models/Complaint');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const CREATE_FIELDS = ['title', 'description', 'category', 'flatNumber'];
const VALID_STATUSES = Complaint.STATUSES;

function pick(body, fields) {
  const result = {};
  for (const field of fields) {
    if (body[field] !== undefined) result[field] = body[field];
  }
  return result;
}

/**
 * POST /api/complaints
 * File a complaint. Initial status is Open.
 */
const createComplaint = asyncHandler(async (req, res) => {
  const complaint = await Complaint.create(pick(req.body, CREATE_FIELDS));
  res.status(201).json({ complaint });
});

/**
 * GET /api/complaints
 * List complaints, newest first.
 */
const listComplaints = asyncHandler(async (_req, res) => {
  const complaints = await Complaint.find().sort({ createdAt: -1 });
  res.json({ count: complaints.length, complaints });
});

/**
 * PATCH /api/complaints/:id/status
 * Record a complaint status transition.
 */
const updateComplaintStatus = asyncHandler(async (req, res) => {
  const { status, note = '' } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    throw new ApiError(
      400,
      'INVALID_STATUS',
      `Status must be one of: ${VALID_STATUSES.join(', ')}.`,
      'status',
    );
  }

  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) {
    throw new ApiError(404, 'NOT_FOUND', 'Complaint not found.');
  }

  if (complaint.status === status) {
    throw new ApiError(
      400,
      'STATUS_UNCHANGED',
      'The complaint already has this status.',
      'status',
    );
  }

  complaint.status = status;
  complaint.statusHistory.push({
    status,
    changedAt: new Date(),
    note,
  });

  await complaint.save();
  res.json({ complaint });
});

module.exports = {
  createComplaint,
  listComplaints,
  updateComplaintStatus,
};
