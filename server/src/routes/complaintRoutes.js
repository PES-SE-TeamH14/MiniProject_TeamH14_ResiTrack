
const express = require('express');
const {
  createComplaint,
  listComplaints,
  updateComplaintStatus,
} = require('../controllers/complaintController');

const router = express.Router();

router.route('/').post(createComplaint).get(listComplaints);
router.patch('/:id/status', updateComplaintStatus);

module.exports = router;
