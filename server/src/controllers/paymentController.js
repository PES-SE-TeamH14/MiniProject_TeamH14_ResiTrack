const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const PAYMENT_FIELDS = ['month', 'amount', 'paidOn', 'method', 'reference'];

function pick(body, fields) {
  const out = {};
  for (const field of fields) {
    if (body[field] !== undefined) out[field] = body[field];
  }
  return out;
}

function checkMonth(month) {
  if (typeof month !== 'string' || !Payment.MONTH_PATTERN.test(month)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Rent month must be in YYYY-MM format.', 'month');
  }
}

function populatePayment(query) {
  return query.populate('tenant', 'name email phone').populate('flat', 'flatNumber block monthlyRent');
}

/**
 * POST /api/payments — Admin. Record a tenant's rent for a month (FR-06, UC-06).
 * If no amount is sent, the flat's monthly rent is used.
 */
const createPayment = asyncHandler(async (req, res) => {
  const { tenant: tenantId } = req.body;
  if (!mongoose.isValidObjectId(tenantId)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Select a valid tenant.', 'tenant');
  }
  checkMonth(req.body.month);

  const tenant = await Tenant.findById(tenantId).populate('flat', 'flatNumber monthlyRent');
  if (!tenant) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Selected tenant does not exist.', 'tenant');
  }
  if (!tenant.isActive) {
    throw new ApiError(409, 'TENANT_INACTIVE', `${tenant.name} has moved out; rent cannot be recorded.`, 'tenant');
  }

  const existing = await Payment.findOne({ tenant: tenant._id, month: req.body.month });
  if (existing) {
    throw new ApiError(
      409,
      'ALREADY_PAID',
      `Rent for ${req.body.month} is already recorded for ${tenant.name}.`,
      'month',
    );
  }

  const data = pick(req.body, PAYMENT_FIELDS);
  if (data.amount === undefined || data.amount === '') data.amount = tenant.flat?.monthlyRent;

  const payment = await Payment.create({ ...data, tenant: tenant._id, flat: tenant.flat?._id });
  const saved = await populatePayment(Payment.findById(payment._id));
  res.status(201).json({ payment: saved });
});

/**
 * GET /api/payments?month=YYYY-MM&tenant=<id> — Admin. Payment history, newest first.
 */
const listPayments = asyncHandler(async (req, res) => {
  const { month, tenant } = req.query;
  const filter = {};
  if (month !== undefined) {
    checkMonth(month);
    filter.month = month;
  }
  if (tenant !== undefined) {
    if (!mongoose.isValidObjectId(tenant)) {
      throw new ApiError(400, 'INVALID_QUERY', 'tenant must be a valid id.', 'tenant');
    }
    filter.tenant = tenant;
  }

  const payments = await populatePayment(Payment.find(filter).sort({ paidOn: -1, createdAt: -1 }));
  res.json({ count: payments.length, payments });
});

/**
 * GET /api/payments/status?month=YYYY-MM — Admin.
 * Every current tenant whose lease covers the month, marked Paid or Unpaid, with totals.
 */
const getRentStatus = asyncHandler(async (req, res) => {
  const { month } = req.query;
  checkMonth(month);

  const monthStart = new Date(`${month}-01T00:00:00.000Z`);
  const nextMonth = new Date(monthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

  const tenants = await Tenant.find({
    isActive: true,
    leaseStart: { $lt: nextMonth },
    leaseEnd: { $gte: monthStart },
  })
    .populate('flat', 'flatNumber block monthlyRent')
    .sort({ name: 1 });

  const payments = await Payment.find({ month, tenant: { $in: tenants.map((t) => t._id) } });
  const paymentByTenant = new Map(payments.map((p) => [String(p.tenant), p]));

  const rows = tenants.map((tenant) => {
    const payment = paymentByTenant.get(String(tenant._id)) || null;
    return {
      tenant: { _id: tenant._id, name: tenant.name, email: tenant.email, phone: tenant.phone },
      flat: tenant.flat,
      rent: tenant.flat?.monthlyRent ?? 0,
      status: payment ? 'Paid' : 'Unpaid',
      payment,
    };
  });

  const summary = {
    month,
    tenants: rows.length,
    paid: rows.filter((r) => r.status === 'Paid').length,
    unpaid: rows.filter((r) => r.status === 'Unpaid').length,
    expected: rows.reduce((sum, r) => sum + r.rent, 0),
    collected: rows.reduce((sum, r) => sum + (r.payment ? r.payment.amount : 0), 0),
  };

  res.json({ summary, rows });
});

/**
 * GET /api/payments/:id — Admin.
 */
const getPayment = asyncHandler(async (req, res) => {
  const payment = await populatePayment(Payment.findById(req.params.id));
  if (!payment) throw new ApiError(404, 'NOT_FOUND', 'Payment not found.');
  res.json({ payment });
});

module.exports = { createPayment, listPayments, getRentStatus, getPayment };
