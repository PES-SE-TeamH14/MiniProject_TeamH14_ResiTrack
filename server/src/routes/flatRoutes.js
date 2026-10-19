const express = require('express');
const { createFlat, listFlats, getFlat, updateFlat } = require('../controllers/flatController');

const router = express.Router();

// Admin only (FR-12, FR-14). When the RBAC middleware from #4 is merged, add:
//   router.use(protect, authorize('admin'));

router.route('/').get(listFlats).post(createFlat);
router.route('/:id').get(getFlat).patch(updateFlat);

module.exports = router;
