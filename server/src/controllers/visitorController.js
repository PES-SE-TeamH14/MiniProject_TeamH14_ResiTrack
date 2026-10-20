
const Visitor = require('../models/Visitor');
const asyncHandler = require('../utils/asyncHandler');

const CREATE_FIELDS = ['visitorName', 'contact', 'purpose', 'flatNumber'];

function pick(body, fields) {
  const result = {};
  for (const field of fields) {
    if (body[field] !== undefined) result[field] = body[field];
  }
  return result;
}

/**
 * POST /api/visitors
 * Register a visitor entry.
 */
const createVisitor = asyncHandler(async (req, res) => {
  const visitor = await Visitor.create(pick(req.body, CREATE_FIELDS));
  res.status(201).json({ visitor });
});

/**
 * GET /api/visitors
 * List visitor entries, newest first.
 */
const listVisitors = asyncHandler(async (_req, res) => {
  const visitors = await Visitor.find().sort({ createdAt: -1 });
  res.json({ count: visitors.length, visitors });
});

module.exports = { createVisitor, listVisitors };
