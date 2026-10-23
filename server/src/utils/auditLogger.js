
const AuditLog = require('../models/AuditLog');

/**
 * Records an authenticated user's action.
 * Call only with explicitly selected, non-sensitive metadata.
 */
async function recordAuditLog({
  actorId,
  action,
  resourceType,
  resourceId = null,
  metadata = {},
}) {
  if (!actorId) {
    throw new Error('Audit log requires an actor ID');
  }

  return AuditLog.create({
    actorId,
    action,
    resourceType,
    resourceId: resourceId == null ? null : String(resourceId),
    metadata,
    timestamp: new Date(),
  });
}

module.exports = { recordAuditLog };
