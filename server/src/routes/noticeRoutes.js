const express = require('express');
const { createNotice, listNotices } = require('../controllers/noticeController');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// FR-03; SAD §3.2: every logged-in role can read notices, only admins publish them
router.get('/', authorize('admin', 'resident', 'maintenance', 'owner'), listNotices);
router.post('/', authorize('admin'), createNotice);

module.exports = router;
