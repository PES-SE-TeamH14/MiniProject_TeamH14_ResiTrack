const express = require('express');
const {
  createTenant,
  listTenants,
  getTenant,
  updateTenant,
  moveOutTenant,
} = require('../controllers/tenantController');

const router = express.Router();

// Admin only (FR-01, FR-14). When the RBAC middleware from #4 is merged, add:
//   router.use(protect, authorize('admin'));

router.route('/').get(listTenants).post(createTenant);
router.route('/:id').get(getTenant).patch(updateTenant);
router.post('/:id/move-out', moveOutTenant);

module.exports = router;
