const Flat = require('../models/Flat');
const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const TREND_MONTHS = 6;

/** The current month as YYYY-MM in India time, so the 1st of the month starts at IST midnight. */
function currentMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}`;
}

/** 'YYYY-MM' -> the month `offset` months away, e.g. shiftMonth('2026-01', -1) === '2025-12'. */
function shiftMonth(month, offset) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

/** One decimal place, e.g. 66.666… -> 66.7. Returns 0 when there is nothing to divide by. */
function percent(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

/** Active flats and how many of them are occupied, counted by MongoDB. */
async function occupancyTotals() {
  const rows = await Flat.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$isOccupied', count: { $sum: 1 } } },
  ]);
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const occupied = rows.find((r) => r._id === true)?.count ?? 0;
  return {
    totalFlats: total,
    occupiedFlats: occupied,
    vacantFlats: total - occupied,
    occupancyRate: percent(occupied, total),
  };
}

/** Rent recorded for each of the given months: { 'YYYY-MM': { collected, payments } }. */
async function collectedByMonth(months) {
  const rows = await Payment.aggregate([
    { $match: { month: { $in: months } } },
    { $group: { _id: '$month', collected: { $sum: '$amount' }, payments: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, { collected: r.collected, payments: r.payments }]));
}

/**
 * Rent due for the month. Uses the same rule as the admin Rent page (FR-06): a tenant owes rent
 * for a month if they are a current tenant and their lease covers any part of that month.
 */
async function rentDue(month) {
  const monthStart = new Date(`${month}-01T00:00:00.000Z`);
  const nextMonth = new Date(`${shiftMonth(month, 1)}-01T00:00:00.000Z`);

  const tenants = await Tenant.find({
    isActive: true,
    leaseStart: { $lt: nextMonth },
    leaseEnd: { $gte: monthStart },
  })
    .select('_id flat')
    .populate('flat', 'monthlyRent')
    .lean();

  const paid = await Payment.find({ month, tenant: { $in: tenants.map((t) => t._id) } })
    .select('tenant')
    .lean();
  const paidTenants = new Set(paid.map((p) => String(p.tenant)));

  let expected = 0;
  let dues = 0;
  let unpaid = 0;
  for (const tenant of tenants) {
    const rent = tenant.flat?.monthlyRent ?? 0;
    expected += rent;
    if (!paidTenants.has(String(tenant._id))) {
      dues += rent;
      unpaid += 1;
    }
  }

  return { billableTenants: tenants.length, paidTenants: tenants.length - unpaid, unpaidTenants: unpaid, expected, dues };
}

/**
 * GET /api/reports/financial-summary?month=YYYY-MM — Owner (and Admin), read-only (FR-10, UC-10).
 *
 * Totals for the month (default: the current month in India time):
 *   occupancy   active flats, occupied / vacant, occupancy rate (%)
 *   rent        expected  rent owed by current tenants whose lease covers the month
 *               collected all rent recorded for the month
 *               dues      rent still unpaid by those tenants
 *   trend       rent collected in each of the last 6 months, oldest first
 * Only totals are returned, never tenant names or contact details.
 */
const getFinancialSummary = asyncHandler(async (req, res) => {
  const month = req.query.month ?? currentMonth();
  if (typeof month !== 'string' || !Payment.MONTH_PATTERN.test(month)) {
    throw new ApiError(400, 'INVALID_QUERY', 'month must be in YYYY-MM format.', 'month');
  }

  const trendMonths = Array.from({ length: TREND_MONTHS }, (_, i) => shiftMonth(month, i - (TREND_MONTHS - 1)));

  const [occupancy, collected, due] = await Promise.all([
    occupancyTotals(),
    collectedByMonth(trendMonths),
    rentDue(month),
  ]);

  const thisMonth = collected.get(month) || { collected: 0, payments: 0 };

  res.json({
    month,
    generatedAt: new Date().toISOString(),
    occupancy,
    rent: {
      expected: due.expected,
      collected: thisMonth.collected,
      dues: due.dues,
      payments: thisMonth.payments,
      billableTenants: due.billableTenants,
      paidTenants: due.paidTenants,
      unpaidTenants: due.unpaidTenants,
      collectionRate: percent(due.paidTenants, due.billableTenants),
    },
    trend: trendMonths.map((m) => ({ month: m, collected: collected.get(m)?.collected ?? 0 })),
  });
});

module.exports = { getFinancialSummary, currentMonth, shiftMonth };
