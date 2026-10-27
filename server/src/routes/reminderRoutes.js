const express = require('express');
const { runReminders, listReminders } = require('../controllers/reminderController');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// Admin only (FR-07, FR-14)
router.use(authorize('admin'));

router.get('/', listReminders);
router.post('/run', runReminders);

module.exports = router;
