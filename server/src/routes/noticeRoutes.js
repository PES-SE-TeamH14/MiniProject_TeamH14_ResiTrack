const express = require('express');
const { createNotice, listNotices } = require('../controllers/noticeController');
const { authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authorize('resident', 'admin'), listNotices);
router.post('/', authorize('admin'), createNotice);

module.exports = router;
