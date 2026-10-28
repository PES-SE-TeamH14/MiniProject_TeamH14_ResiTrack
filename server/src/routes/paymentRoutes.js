const express = require('express');
const {
  createPayment,
  listPayments,
  getRentStatus,
  getPayment,
  listMyPayments,
  getReceipt,
} = require('../controllers/paymentController');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// Residents see their own payments and download their own receipts (FR-15, UC-15).
// These two routes come first because everything below them is Admin only.
router.get('/mine', authorize('resident'), listMyPayments);
router.get('/:id/receipt', authorize('admin', 'resident'), getReceipt);

// Admin only (FR-06, FR-14)
router.use(authorize('admin'));

router.route('/').get(listPayments).post(createPayment);
router.get('/status', getRentStatus); // must come before /:id
router.get('/:id', getPayment);

module.exports = router;
