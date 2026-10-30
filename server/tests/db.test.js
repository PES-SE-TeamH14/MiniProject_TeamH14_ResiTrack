// NFR-09 (#29): unit test for the database connection helper, with Mongoose mocked out
jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  connection: { host: 'mock-host' },
}));

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');

describe('connectDB (config/db.js)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mongoose.connect.mockClear();
  });

  afterEach(() => jest.restoreAllMocks());

  it('refuses to start without MONGODB_URI', async () => {
    await expect(connectDB(undefined)).rejects.toThrow('MONGODB_URI is not set');
    expect(mongoose.connect).not.toHaveBeenCalled();
  });

  it('connects with the given URI and returns the connection', async () => {
    const connection = await connectDB('mongodb://example/resitrack');

    expect(mongoose.connect).toHaveBeenCalledWith('mongodb://example/resitrack');
    expect(connection).toBe(mongoose.connection);
  });

  it('passes connection failures to the caller', async () => {
    mongoose.connect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(connectDB('mongodb://down')).rejects.toThrow('ECONNREFUSED');
  });
});
