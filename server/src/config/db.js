const mongoose = require('mongoose');

/**
 * Connects to MongoDB. All data access goes through Mongoose models (SAD §2.1).
 */
async function connectDB(uri) {
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy server/.env.example to server/.env');
  }
  await mongoose.connect(uri);
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
  return mongoose.connection;
}

module.exports = connectDB;
