
const express = require('express');
const {
  createComplaint,
  listComplaints,
  updateComplaintStatus,
} = require('../controllers/complaintController');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// FR-13, FR-14
router.post('/', authorize('resident', 'admin'), createComplaint);
router.get('/', authorize('resident', 'admin', 'maintenance'), listComplaints);
router.patch('/:id/status', authorize('admin', 'maintenance'), updateComplaintStatus);

module.exports = router;
