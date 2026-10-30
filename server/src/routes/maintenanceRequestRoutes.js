const express = require('express');
const {
  createMaintenanceRequest,
  listMaintenanceRequests,
} = require('../controllers/maintenanceRequestController');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// FR-04, FR-14
router.post('/', authorize('resident'), createMaintenanceRequest);
router.get('/', authorize('resident', 'admin', 'maintenance'), listMaintenanceRequests);

module.exports = router;
