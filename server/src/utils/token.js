const jwt = require('jsonwebtoken');

// NFR-05: a session lasts 30 minutes unless JWT_EXPIRES_IN says otherwise.
const DEFAULT_EXPIRES_IN = '30m';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set. Copy server/.env.example to server/.env');
  }
  return secret;
}

/**
 * Issues a signed JWT carrying the user's id and role (SAD §2.3).
 */
function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN,
  });
}

/**
 * Verifies a JWT and returns its payload. Throws if it is invalid or expired.
 * Used by the auth / RBAC middleware (#4).
 */
function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

module.exports = { signToken, verifyToken };
