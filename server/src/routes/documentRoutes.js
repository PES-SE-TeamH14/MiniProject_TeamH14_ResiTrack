const express = require('express');
const { uploadDocument, listDocuments, downloadDocument } = require('../controllers/documentController');
const { uploadSingleFile } = require('../middleware/upload');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// Admin only (FR-11, FR-14). The role is checked before the upload is read.
router.use(authorize('admin'));

router.route('/').get(listDocuments).post(uploadSingleFile, uploadDocument);
router.get('/:id/file', downloadDocument);

module.exports = router;
