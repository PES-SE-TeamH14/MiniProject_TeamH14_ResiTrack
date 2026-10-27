/**
 * Seeds a full-size complex for performance tests (NFR-01 #22, NFR-08 #23):
 * 500 flats, 500 current tenants, 3 months of rent payments, visitors and complaints,
 * plus one admin and one resident login.
 *
 * Used by tests/scale.test.js and scripts/perf/runLoadTest.js. It expects an EMPTY
 * database that mongoose is already connected to; it never connects on its own.
 */
const bcrypt = require('bcryptjs');
const User = require('../../src/models/User');
const Flat = require('../../src/models/Flat');
const Tenant = require('../../src/models/Tenant');
const Payment = require('../../src/models/Payment');
const Visitor = require('../../src/models/Visitor');
const Complaint = require('../../src/models/Complaint');

const MODELS = [User, Flat, Tenant, Payment, Visitor, Complaint];
const BLOCKS = ['A', 'B', 'C', 'D', 'E'];
const TYPES = ['1BHK', '2BHK', '3BHK'];
const RENT_BY_TYPE = { '1BHK': 12000, '2BHK': 18000, '3BHK': 25000 };
const CATEGORIES = ['Plumbing', 'Electrical', 'Lift', 'Security', 'Cleaning'];
const DAY_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM' for the month `offset` months before `date` (UTC). */
function monthKey(date, offset = 0) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function seedPerfData({
  tenants: tenantCount = 500,
  visitors: visitorCount = 300,
  complaints: complaintCount = 300,
  password = 'Perf@12345',
  now = new Date(),
} = {}) {
  // Build indexes first so the test measures the real, indexed setup
  await Promise.all(MODELS.map((model) => model.createIndexes()));

  const hash = await bcrypt.hash(password, User.SALT_ROUNDS);
  const [admin, resident] = await User.insertMany([
    { name: 'Perf Admin', email: 'perf-admin@resitrack.local', password: hash, role: 'admin' },
    { name: 'Perf Resident', email: 'perf-resident@resitrack.local', password: hash, role: 'resident' },
  ]);

  const perBlock = Math.ceil(tenantCount / BLOCKS.length);
  const flats = await Flat.insertMany(
    Array.from({ length: tenantCount }, (_, i) => {
      const block = BLOCKS[Math.floor(i / perBlock)];
      const n = (i % perBlock) + 1;
      const floor = Math.floor((n - 1) / 10);
      const type = TYPES[i % TYPES.length];
      return {
        flatNumber: `${block}-${floor}${String(((n - 1) % 10) + 1).padStart(2, '0')}`,
        block,
        floor,
        type,
        monthlyRent: RENT_BY_TYPE[type],
        isOccupied: true,
      };
    }),
  );

  const leaseStart = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));
  const leaseEnd = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), 1));
  const tenants = await Tenant.insertMany(
    flats.map((flat, i) => ({
      name: `Tenant ${String(i + 1).padStart(3, '0')}`,
      email: `tenant${i + 1}@perf.local`,
      phone: `9${String(800000000 + i).padStart(9, '0')}`,
      flat: flat._id,
      leaseStart,
      leaseEnd,
    })),
  );

  // Two full past months, and 70% of tenants have paid the current month
  const payments = [];
  for (const [offset, share] of [[2, 1], [1, 1], [0, 0.7]]) {
    const month = monthKey(now, offset);
    const paidOn = new Date(Math.min(now.getTime(), new Date(`${month}-05T10:00:00Z`).getTime()));
    tenants.slice(0, Math.floor(tenants.length * share)).forEach((tenant, i) => {
      payments.push({
        tenant: tenant._id,
        flat: flats[i]._id,
        month,
        amount: flats[i].monthlyRent,
        paidOn,
        method: i % 2 ? 'UPI' : 'Bank transfer',
      });
    });
  }
  await Payment.insertMany(payments);

  await Visitor.insertMany(
    Array.from({ length: visitorCount }, (_, i) => ({
      visitorName: `Visitor ${i + 1}`,
      contact: `9${String(700000000 + i).padStart(9, '0')}`,
      purpose: i % 3 ? 'Delivery' : 'Guest',
      flatNumber: flats[i % flats.length].flatNumber,
      createdAt: new Date(now.getTime() - i * 60 * 60 * 1000),
    })),
  );

  await Complaint.insertMany(
    Array.from({ length: complaintCount }, (_, i) => ({
      title: `${CATEGORIES[i % CATEGORIES.length]} issue ${i + 1}`,
      description: 'Seeded complaint for the performance test.',
      category: CATEGORIES[i % CATEGORIES.length],
      flatNumber: flats[i % flats.length].flatNumber,
      status: ['Open', 'In Progress', 'Resolved'][i % 3],
      createdAt: new Date(now.getTime() - i * DAY_MS),
    })),
  );

  return {
    admin,
    resident,
    password,
    currentMonth: monthKey(now),
    counts: {
      flats: flats.length,
      tenants: tenants.length,
      payments: payments.length,
      visitors: visitorCount,
      complaints: complaintCount,
    },
  };
}

module.exports = { seedPerfData, monthKey };
