const mongoose = require('mongoose');

const DOC_TYPES = ['Lease agreement', 'ID proof', 'Other'];
const MIME_TYPES = ['application/pdf', 'image/jpeg'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // FR-11: files up to 5 MB

/**
 * A tenant document uploaded by the Admin: lease agreement or ID proof (FR-11, UC-11).
 * The file is stored in MongoDB with its record. A 5 MB file is well under MongoDB's 16 MB
 * document limit, and uploads survive redeploys without needing a separate file store.
 */
const documentSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant is required'],
      index: true,
    },
    docType: {
      type: String,
      required: [true, 'Document type is required'],
      enum: { values: DOC_TYPES, message: `Document type must be one of: ${DOC_TYPES.join(', ')}` },
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    mimeType: {
      type: String,
      required: true,
      enum: MIME_TYPES,
    },
    size: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_SIZE_BYTES,
    },
    // The file contents. Never returned by queries unless asked for with .select('+data')
    data: {
      type: Buffer,
      required: true,
      select: false,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.data;
        delete ret.__v;
        return ret;
      },
    },
  },
);

documentSchema.statics.DOC_TYPES = DOC_TYPES;
documentSchema.statics.MIME_TYPES = MIME_TYPES;
documentSchema.statics.MAX_SIZE_BYTES = MAX_SIZE_BYTES;

module.exports = mongoose.model('Document', documentSchema);
