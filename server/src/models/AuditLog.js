
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      immutable: true,
    },
    resourceType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      immutable: true,
    },
    resourceId: {
      type: String,
      default: null,
      immutable: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      immutable: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },
  },
  {
    versionKey: false,
    strict: true,
  },
);

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ actorId: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
