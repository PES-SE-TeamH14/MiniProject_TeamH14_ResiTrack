
const mongoose = require('mongoose');

const COMPLAINT_STATUSES = ['Open', 'In Progress', 'Resolved'];

const complaintSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Complaint title is required'],
      trim: true,
      maxlength: [120, 'Title can be at most 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Complaint description is required'],
      trim: true,
      maxlength: [2000, 'Description can be at most 2000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Complaint category is required'],
      trim: true,
      maxlength: [60, 'Category can be at most 60 characters'],
    },
    flatNumber: {
      type: String,
      required: [true, 'Flat number is required'],
      trim: true,
      uppercase: true,
      maxlength: [20, 'Flat number can be at most 20 characters'],
    },
    status: {
      type: String,
      enum: {
        values: COMPLAINT_STATUSES,
        message: `Status must be one of: ${COMPLAINT_STATUSES.join(', ')}`,
      },
      default: 'Open',
    },
    statusHistory: {
      type: [
        {
          status: {
            type: String,
            enum: COMPLAINT_STATUSES,
            required: true,
          },
          changedAt: {
            type: Date,
            default: Date.now,
          },
          note: {
            type: String,
            trim: true,
            maxlength: 500,
            default: '',
          },
        },
      ],
      default: function initialStatusHistory() {
        return [{ status: this.status || 'Open' }];
      },
    },
  },
  { timestamps: true },
);

// NFR-08 (#23): complaints are listed newest first and looked up by flat
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ flatNumber: 1, createdAt: -1 });

complaintSchema.statics.STATUSES = COMPLAINT_STATUSES;

module.exports = mongoose.model('Complaint', complaintSchema);
