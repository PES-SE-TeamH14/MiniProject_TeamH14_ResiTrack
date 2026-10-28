const mongoose = require('mongoose');

const TYPES = ['UPCOMING', 'OVERDUE'];
const STATUSES = ['pending', 'sent', 'failed'];

/**
 * A rent reminder sent to a tenant (FR-07, UC-07).
 * One UPCOMING and one OVERDUE reminder per tenant per rent month, so the daily job never repeats itself.
 * The record is created before sending (status "pending"), so two workers cannot both send the same reminder.
 */
const reminderSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    flat: { type: mongoose.Schema.Types.ObjectId, ref: 'Flat', required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, // rent month, YYYY-MM
    type: { type: String, enum: TYPES, required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: STATUSES, default: 'pending' },
    channel: { type: String, default: '' },
    message: { type: String, default: '' },
    sentAt: { type: Date, default: null },
    error: { type: String, default: '' },
  },
  { timestamps: true },
);

reminderSchema.index({ tenant: 1, month: 1, type: 1 }, { unique: true });
reminderSchema.index({ createdAt: -1 });

reminderSchema.statics.TYPES = TYPES;
reminderSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('Reminder', reminderSchema);
