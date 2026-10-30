const express = require('express');
const { getFinancialSummary } = require('../controllers/reportController');
const { authorize } = require('../middleware/auth');
const ApiError = require('../utils/ApiError');

const router = express.Router();

// FR-10 (#28): Owners (and Admins) read summaries; Residents and Maintenance staff get 403
router.use(authorize('owner', 'admin'));

router.get('/financial-summary', getFinancialSummary);

// Reports are read-only: any other method on a report URL is refused
router.all('/financial-summary', (_req, _res, next) => {
  next(new ApiError(405, 'METHOD_NOT_ALLOWED', 'Reports are read-only.'));
});

module.exports = router;
