const express = require('express');
const {
  createMaintenanceRequest,
  listMaintenanceRequests,
  updateMaintenanceRequestStatus,
} = require('../controllers/maintenanceRequestController');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// FR-04, FR-05, FR-09, FR-14
router.post('/', authorize('resident'), createMaintenanceRequest);
router.get('/', authorize('resident', 'admin', 'maintenance'), listMaintenanceRequests);
// SAD §3.2 lists Maintenance only; admin is also allowed so the FR-09 Kanban board can save moves.
router.patch('/:id', authorize('maintenance', 'admin'), updateMaintenanceRequestStatus);

module.exports = router;
