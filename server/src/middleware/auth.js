const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken, verifyToken } = require('../utils/token');

// Response header that carries the refreshed token (sliding session, NFR-05)
const TOKEN_HEADER = 'X-Auth-Token';

function readBearerToken(req) {
  const [scheme, token] = (req.get('Authorization') || '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

function invalidToken() {
  return new ApiError(401, 'INVALID_TOKEN', 'Your login is not valid. Please log in again.');
}

/**
 * Requires a valid login (FR-14, SAD §2.3).
 *   no token            -> 401 AUTH_REQUIRED
 *   bad / tampered      -> 401 INVALID_TOKEN
 *   expired (30 min idle) -> 401 SESSION_EXPIRED (NFR-05)
 *   user gone / disabled -> 401 INVALID_TOKEN
 * On success it sets req.user and req.auth and sends a fresh 30-minute token in the
 * X-Auth-Token header, so the session only ends after 30 minutes without activity.
 */
const protect = asyncHandler(async (req, res, next) => {
  const token = readBearerToken(req);
  if (!token) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Please log in to continue.');
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new ApiError(
        401,
        'SESSION_EXPIRED',
        'Your session expired due to inactivity. Please log in again.',
      );
    }
    if (err instanceof jwt.JsonWebTokenError) throw invalidToken();
    throw err; // e.g. JWT_SECRET missing: a server problem, not the user's
  }

  if (!mongoose.isValidObjectId(payload.sub)) throw invalidToken();
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw invalidToken();

  req.user = user;
  req.auth = {
    userId: String(user._id),
    role: user.role, // read from the database, so a role change applies immediately
    lastActivityAt: new Date(payload.iat * 1000), // when the current token was issued
  };

  // Only a token that passed verification is ever refreshed, so expired tokens cannot be renewed
  res.set(TOKEN_HEADER, signToken(user));
  next();
});

/**
 * Allows only the listed roles (FR-14). Use after protect.
 * Out-of-role requests get 403 before any controller (and any data access) runs.
 *   router.use(authorize('admin'));
 *   router.post('/', authorize('resident', 'admin'), createVisitor);
 */
function authorize(...roles) {
  if (roles.length === 0) {
    throw new Error('authorize() needs at least one role');
  }
  const unknown = roles.filter((role) => !User.ROLES.includes(role));
  if (unknown.length > 0) {
    throw new Error(`authorize(): unknown role(s) ${unknown.join(', ')}`);
  }

  return function checkRole(req, _res, next) {
    if (!req.user) {
      return next(new ApiError(401, 'AUTH_REQUIRED', 'Please log in to continue.'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to do this.'));
    }
    return next();
  };
}

module.exports = { protect, authorize, TOKEN_HEADER };
