const mongoose = require('mongoose');

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/; // YYYY-MM
const METHODS = ['Cash', 'UPI', 'Bank transfer', 'Cheque', 'Other'];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A monthly rent payment recorded by the admin (FR-06, UC-06).
 * One payment per tenant per month.
 */
const paymentSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant is required'],
    },
    flat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Flat',
      required: [true, 'Flat is required'],
      index: true,
    },
    month: {
      type: String,
      required: [true, 'Rent month is required'],
      match: [MONTH_PATTERN, 'Rent month must be in YYYY-MM format'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be greater than zero'],
    },
    paidOn: {
      type: Date,
      required: [true, 'Payment date is required'],
      default: Date.now,
      validate: {
        // One day of slack so a date picked in India just after midnight is not "in the future" in UTC
        validator: (value) => value.getTime() <= Date.now() + ONE_DAY_MS,
        message: 'Payment date cannot be in the future',
      },
    },
    method: {
      type: String,
      enum: { values: METHODS, message: `Method must be one of: ${METHODS.join(', ')}` },
      default: 'UPI',
    },
    reference: {
      type: String,
      trim: true,
      maxlength: [100, 'Reference can be at most 100 characters'],
      default: '',
    },
  },
  { timestamps: true },
);

paymentSchema.index({ tenant: 1, month: 1 }, { unique: true });

paymentSchema.statics.METHODS = METHODS;
paymentSchema.statics.MONTH_PATTERN = MONTH_PATTERN;

module.exports = mongoose.model('Payment', paymentSchema);
