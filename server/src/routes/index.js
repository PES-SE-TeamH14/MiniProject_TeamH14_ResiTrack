const express = require('express');
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const flatRoutes = require('./flatRoutes');
const tenantRoutes = require('./tenantRoutes');
const paymentRoutes = require('./paymentRoutes');
const visitorRoutes = require('./visitorRoutes');
const complaintRoutes = require('./complaintRoutes');
const auditLogRoutes = require('./auditLogRoutes');
const documentRoutes = require('./documentRoutes');
const reminderRoutes = require('./reminderRoutes');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public routes (SAD §3.2)
router.use('/health', healthRoutes);
router.use('/auth', authRoutes); // FR-02 (#3)

// Everything else needs a valid login (FR-14, #4). Each router then lists the roles it allows,
// so a new route is denied by default until its roles are declared.
router.use('/flats', protect, flatRoutes); // FR-12 (#7)
router.use('/tenants', protect, tenantRoutes); // FR-01 (#8)
router.use('/payments', protect, paymentRoutes); // FR-06 (#9)
router.use('/visitors', protect, visitorRoutes); // FR-08 (#13)
router.use('/complaints', protect, complaintRoutes); // FR-13 (#14)
router.use('/audit-logs', protect, auditLogRoutes);
router.use('/documents', protect, documentRoutes); // FR-11 (#21)
router.use('/reminders', protect, reminderRoutes); // FR-07 (#17)

module.exports = router;
