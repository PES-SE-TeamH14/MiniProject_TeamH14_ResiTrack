const multer = require('multer');
const ApiError = require('../utils/ApiError');
const Document = require('../models/Document');

// The upload is held in memory, so nothing is written to disk or the database
// until it has passed every check below (SEC-06: rejected before write)
const parseSingleFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Document.MAX_SIZE_BYTES, files: 1 },
}).single('file');

/**
 * Works out the real file type from its first bytes ("magic numbers"),
 * so renaming a file to .pdf or faking the browser's Content-Type does not get it through.
 */
function detectFileType(buffer) {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
    return 'application/pdf';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  return null;
}

/**
 * Accepts one PDF or JPEG of at most 5 MB in the "file" field (FR-11).
 *   larger than 5 MB  -> 413 FILE_TOO_LARGE
 *   not a PDF/JPEG    -> 415 UNSUPPORTED_FILE_TYPE
 *   no file           -> 400 FILE_REQUIRED
 * On success, req.file.detectedType holds the verified type.
 */
function uploadSingleFile(req, res, next) {
  parseSingleFile(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ApiError(413, 'FILE_TOO_LARGE', 'Files can be at most 5 MB.', 'file'));
      }
      return next(new ApiError(400, 'INVALID_UPLOAD', 'Upload exactly one file, in the "file" field.', 'file'));
    }
    if (err) return next(err);

    if (!req.file) {
      return next(new ApiError(400, 'FILE_REQUIRED', 'Choose a PDF or JPEG file to upload.', 'file'));
    }

    const detectedType = detectFileType(req.file.buffer);
    if (!detectedType) {
      return next(new ApiError(415, 'UNSUPPORTED_FILE_TYPE', 'Only PDF and JPEG files are allowed.', 'file'));
    }

    req.file.detectedType = detectedType;
    return next();
  });
}

module.exports = { uploadSingleFile, detectFileType };
