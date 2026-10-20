const express = require('express');
const {
  createPayment,
  listPayments,
  getRentStatus,
  getPayment,
} = require('../controllers/paymentController');

const router = express.Router();

// Admin only (FR-06, FR-14). When the RBAC middleware from #4 is merged, add:
//   router.use(protect, authorize('admin'));

router.route('/').get(listPayments).post(createPayment);
router.get('/status', getRentStatus); // must come before /:id
router.get('/:id', getPayment);
// GET /:id/receipt (PDF) is added by #18 (FR-15)

module.exports = router;
