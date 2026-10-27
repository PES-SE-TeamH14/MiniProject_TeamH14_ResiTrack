/**
 * Fills a database with sample data for demos and manual testing (e.g. the Sprint-1 demo, #16).
 * Usage: set MONGODB_URI in server/.env, then run `npm run seed-demo`.
 *
 * Creates one login per role, all with the password Demo@12345:
 *   admin@resitrack.local, resident@resitrack.local, maintenance@resitrack.local, owner@resitrack.local
 * and, only if there are no flats yet, sample flats, tenants, rent payments, visitors and complaints.
 * Safe to run more than once. Refuses to run when NODE_ENV=production.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Flat = require('../src/models/Flat');
const Tenant = require('../src/models/Tenant');
const Payment = require('../src/models/Payment');
const Visitor = require('../src/models/Visitor');
const Complaint = require('../src/models/Complaint');

const DEMO_PASSWORD = 'Demo@12345';

const USERS = [
  { name: 'Kavya Admin', email: 'admin@resitrack.local', role: 'admin' },
  { name: 'Asha Rao', email: 'resident@resitrack.local', role: 'resident' },
  { name: 'Manoj Maintenance', email: 'maintenance@resitrack.local', role: 'maintenance' },
  { name: 'Owen Owner', email: 'owner@resitrack.local', role: 'owner' },
];

const FLATS = [
  { flatNumber: 'A-101', block: 'A', floor: 1, type: '2BHK', monthlyRent: 18000 },
  { flatNumber: 'A-102', block: 'A', floor: 1, type: '1BHK', monthlyRent: 12000 },
  { flatNumber: 'B-201', block: 'B', floor: 2, type: '3BHK', monthlyRent: 26000 },
  { flatNumber: 'B-202', block: 'B', floor: 2, type: '2BHK', monthlyRent: 19000 },
  { flatNumber: 'C-301', block: 'C', floor: 3, type: '2BHK', monthlyRent: 20000 },
];

// The current month as YYYY-MM, the format rent payments use
function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthsFromNow(months) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date;
}

async function seedUsers() {
  for (const user of USERS) {
    const existing = await User.findOne({ email: user.email });
    if (existing) {
      console.log(`  user ${user.email} already exists`);
    } else {
      await User.create({ ...user, password: DEMO_PASSWORD }); // hashed by the model (NFR-03)
      console.log(`  created ${user.role} ${user.email}`);
    }
  }
}

async function seedSampleData() {
  if ((await Flat.countDocuments()) > 0) {
    console.log('  flats already exist, so sample flats/tenants/rent/visitors/complaints were skipped');
    return;
  }

  const flats = await Flat.create(FLATS);
  const byNumber = Object.fromEntries(flats.map((flat) => [flat.flatNumber, flat]));

  const tenants = await Tenant.create([
    {
      name: 'Asha Rao',
      email: 'resident@resitrack.local',
      phone: '9876543210',
      flat: byNumber['A-101']._id,
      leaseStart: monthsFromNow(-6),
      leaseEnd: monthsFromNow(6),
    },
    {
      name: 'Ravi Kumar',
      email: 'ravi.kumar@example.com',
      phone: '9123456780',
      flat: byNumber['B-201']._id,
      leaseStart: monthsFromNow(-3),
      leaseEnd: monthsFromNow(9),
    },
    {
      name: 'Meera Iyer',
      email: 'meera.iyer@example.com',
      phone: '9988776655',
      flat: byNumber['A-102']._id,
      leaseStart: monthsFromNow(-1),
      leaseEnd: monthsFromNow(11),
    },
  ]);
  await Flat.updateMany(
    { _id: { $in: tenants.map((tenant) => tenant.flat) } },
    { isOccupied: true },
  );

  // Two tenants have paid this month, one has not, so the Rent page shows both states
  const month = currentMonth();
  await Payment.create([
    { tenant: tenants[0]._id, flat: tenants[0].flat, month, amount: 18000, method: 'UPI', reference: 'UPI-DEMO-1001' },
    { tenant: tenants[1]._id, flat: tenants[1].flat, month, amount: 26000, method: 'Bank transfer', reference: 'NEFT-DEMO-2001' },
  ]);

  await Visitor.create([
    { visitorName: 'Rahul Sharma', contact: '9000011111', purpose: 'Family visit', flatNumber: 'A-101' },
    { visitorName: 'Swiggy delivery', contact: '9000022222', purpose: 'Food delivery', flatNumber: 'B-201' },
  ]);

  const leak = await Complaint.create({
    title: 'Water leakage',
    description: 'Water is leaking from the bathroom ceiling.',
    category: 'Plumbing',
    flatNumber: 'A-101',
  });
  leak.status = 'In Progress';
  leak.statusHistory.push({ status: 'In Progress', changedAt: new Date(), note: 'Plumber assigned' });
  await leak.save();

  await Complaint.create({
    title: 'Corridor light not working',
    description: 'The light outside B-201 has been off for three days.',
    category: 'Electrical',
    flatNumber: 'B-201',
  });

  console.log(`  created ${flats.length} flats, ${tenants.length} tenants, 2 payments, 2 visitors, 2 complaints`);
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-demo creates demo logins with a known password and must not run in production.');
  }
  if (!process.env.MONGODB_URI) {
    throw new Error('Set MONGODB_URI in server/.env first.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Seeding demo data...');
  await seedUsers();
  await seedSampleData();
  console.log(`Done. Log in with any demo email and the password ${DEMO_PASSWORD}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(`Could not seed demo data: ${err.message}`);
  await mongoose.disconnect();
  process.exit(1);
});
