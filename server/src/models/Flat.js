const mongoose = require('mongoose');

const FLAT_TYPES = ['1RK', '1BHK', '2BHK', '3BHK', '4BHK', 'Other'];

/**
 * A residential unit in the complex (FR-12).
 * isOccupied is set when a tenant is assigned (FR-01, #8), not by the flats API.
 */
const flatSchema = new mongoose.Schema(
  {
    flatNumber: {
      type: String,
      required: [true, 'Flat number is required'],
      trim: true,
      uppercase: true,
      maxlength: [20, 'Flat number can be at most 20 characters'],
      unique: true,
    },
    block: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [20, 'Block can be at most 20 characters'],
      default: '',
    },
    floor: {
      type: Number,
      min: [0, 'Floor cannot be negative'],
      default: 0,
    },
    type: {
      type: String,
      enum: { values: FLAT_TYPES, message: `Type must be one of: ${FLAT_TYPES.join(', ')}` },
      default: '2BHK',
    },
    monthlyRent: {
      type: Number,
      required: [true, 'Monthly rent is required'],
      min: [0, 'Monthly rent cannot be negative'],
    },
    isActive: { type: Boolean, default: true },
    isOccupied: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// NFR-08 (#23): the flat list is sorted by block, then flat number
flatSchema.index({ block: 1, flatNumber: 1 });

flatSchema.statics.TYPES = FLAT_TYPES;

module.exports = mongoose.model('Flat', flatSchema);
