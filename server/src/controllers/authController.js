const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../utils/token');

/**
 * POST /api/auth/login — Public. Log in with email and password (FR-02).
 * Returns a JWT and the user (without the password).
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  // Only plain strings are accepted, which also blocks query objects such as { "$gt": "" }
  if (typeof email !== 'string' || !email.trim()) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Email is required.', 'email');
  }
  if (typeof password !== 'string' || !password) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Password is required.', 'password');
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');

  // Same answer for an unknown email and a wrong password, so the API does not reveal who is registered
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been deactivated. Contact the administrator.');
  }

  res.json({ token: signToken(user), user });
});

module.exports = { login };
