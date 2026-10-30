const mongoose = require('mongoose');

const CATEGORIES = ['Plumbing', 'Electrical', 'Cleaning', 'Security', 'Appliance', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const STATUSES = ['Open', 'In Progress', 'Resolved'];

const maintenanceRequestSchema = new mongoose.Schema(
  {
    resident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Resident is required'],
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: { values: CATEGORIES, message: `Category must be one of: ${CATEGORIES.join(', ')}` },
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description can be at most 2000 characters'],
    },
    priority: {
      type: String,
      required: [true, 'Priority is required'],
      enum: { values: PRIORITIES, message: `Priority must be one of: ${PRIORITIES.join(', ')}` },
      default: 'Medium',
    },
    status: {
      type: String,
      enum: { values: STATUSES, message: `Status must be one of: ${STATUSES.join(', ')}` },
      default: 'Open',
    },
  },
  { timestamps: true },
);

maintenanceRequestSchema.statics.CATEGORIES = CATEGORIES;
maintenanceRequestSchema.statics.PRIORITIES = PRIORITIES;
maintenanceRequestSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('MaintenanceRequest', maintenanceRequestSchema);
