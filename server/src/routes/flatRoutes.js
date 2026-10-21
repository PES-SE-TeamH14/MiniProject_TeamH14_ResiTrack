const express = require('express');
const { createFlat, listFlats, getFlat, updateFlat } = require('../controllers/flatController');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// Admin only (FR-12, FR-14)
router.use(authorize('admin'));

router.route('/').get(listFlats).post(createFlat);
router.route('/:id').get(getFlat).patch(updateFlat);

module.exports = router;
