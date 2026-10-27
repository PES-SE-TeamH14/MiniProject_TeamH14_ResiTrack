const mongoose = require('mongoose');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9]{10,13}$/;

/**
 * A tenant living in (or who lived in) a flat (FR-01).
 * isActive = current tenant. Moving out keeps the record for history.
 */
const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name can be at most 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [EMAIL_PATTERN, 'Email is not valid'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [PHONE_PATTERN, 'Phone number must be 10 to 13 digits'],
    },
    flat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Flat',
      required: [true, 'Flat is required'],
      index: true,
    },
    leaseStart: {
      type: Date,
      required: [true, 'Lease start date is required'],
    },
    leaseEnd: {
      type: Date,
      required: [true, 'Lease end date is required'],
      validate: {
        validator(value) {
          return !this.leaseStart || value > this.leaseStart;
        },
        message: 'Lease end date must be after the start date',
      },
    },
    isActive: { type: Boolean, default: true },
    movedOutAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// An email can belong to only one *current* tenant; past tenants may register again.
tenantSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

// NFR-08 (#23): the tenant list and the monthly rent status filter by isActive and sort by name
tenantSchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model('Tenant', tenantSchema);
