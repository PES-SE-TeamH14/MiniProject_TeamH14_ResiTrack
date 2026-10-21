const express = require('express');
const {
  createTenant,
  listTenants,
  getTenant,
  updateTenant,
  moveOutTenant,
} = require('../controllers/tenantController');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// Admin only (FR-01, FR-14)
router.use(authorize('admin'));

router.route('/').get(listTenants).post(createTenant);
router.route('/:id').get(getTenant).patch(updateTenant);
router.post('/:id/move-out', moveOutTenant);

module.exports = router;
