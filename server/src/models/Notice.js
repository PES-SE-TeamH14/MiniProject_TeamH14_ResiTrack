const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Notice title is required'],
      trim: true,
      maxlength: [120, 'Notice title can be at most 120 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notice message is required'],
      trim: true,
      maxlength: [5000, 'Notice message can be at most 5000 characters'],
    },
    isActive: { type: Boolean, default: true },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

noticeSchema.index({ isActive: 1, publishedAt: -1 });

module.exports = mongoose.model('Notice', noticeSchema);
