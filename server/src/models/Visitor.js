
const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema(
  {
    visitorName: {
      type: String,
      required: [true, 'Visitor name is required'],
      trim: true,
      maxlength: [100, 'Visitor name can be at most 100 characters'],
    },
    contact: {
      type: String,
      required: [true, 'Visitor contact is required'],
      trim: true,
      maxlength: [30, 'Visitor contact can be at most 30 characters'],
    },
    purpose: {
      type: String,
      required: [true, 'Purpose of visit is required'],
      trim: true,
      maxlength: [200, 'Purpose can be at most 200 characters'],
    },
    flatNumber: {
      type: String,
      required: [true, 'Flat number is required'],
      trim: true,
      uppercase: true,
      maxlength: [20, 'Flat number can be at most 20 characters'],
    },
  },
  { timestamps: true },
);

// NFR-08 (#23): visitors are listed newest first and looked up by flat
visitorSchema.index({ createdAt: -1 });
visitorSchema.index({ flatNumber: 1, createdAt: -1 });

module.exports = mongoose.model('Visitor', visitorSchema);
