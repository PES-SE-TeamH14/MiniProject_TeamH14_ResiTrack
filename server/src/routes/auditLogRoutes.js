
const express = require('express');
const { listAuditLogs } = require('../controllers/auditLogController');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// The parent router applies protect; this route additionally requires an admin.
router.use(authorize('admin'));

router.get('/', listAuditLogs);

module.exports = router;
