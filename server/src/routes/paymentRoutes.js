const express = require('express');
const {
  createPayment,
  listPayments,
  getRentStatus,
  getPayment,
} = require('../controllers/paymentController');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// Admin only (FR-06, FR-14)
router.use(authorize('admin'));

router.route('/').get(listPayments).post(createPayment);
router.get('/status', getRentStatus); // must come before /:id
router.get('/:id', getPayment);
// GET /:id/receipt (PDF) is added by #18 (FR-15)

module.exports = router;
