/**
 * Creates the first Administrator account, so someone can log in (FR-02).
 * Usage: set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env, then run `npm run create-admin`.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function main() {
  const { MONGODB_URI, ADMIN_NAME = 'Administrator', ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!MONGODB_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Set MONGODB_URI, ADMIN_EMAIL and ADMIN_PASSWORD in server/.env first.');
  }

  await mongoose.connect(MONGODB_URI);
  const existing = await User.findOne({ email: ADMIN_EMAIL.trim().toLowerCase() });
  if (existing) {
    console.log(`A user with email ${existing.email} already exists. Nothing to do.`);
  } else {
    const admin = await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'admin',
    });
    console.log(`Admin account created for ${admin.email}.`);
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(`Could not create admin: ${err.message}`);
  await mongoose.disconnect();
  process.exit(1);
});
