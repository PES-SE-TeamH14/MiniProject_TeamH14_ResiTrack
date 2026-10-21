
const express = require('express');
const { createVisitor, listVisitors } = require('../controllers/visitorController');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// FR-08, FR-14: residents log their visitors; the Admin also logs walk-ins from the Visitors page
router.post('/', authorize('resident', 'admin'), createVisitor);
router.get('/', authorize('admin'), listVisitors);

module.exports = router;
