const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Starts a throwaway in-memory MongoDB for API tests, so tests never touch a real database.
let mongo;

async function connect() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}

async function clear() {
  const { collections } = mongoose.connection;
  for (const name of Object.keys(collections)) {
    await collections[name].deleteMany({});
  }
}

async function close() {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
}

module.exports = { connect, clear, close };
