const express = require('express');
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const flatRoutes = require('./flatRoutes');
const tenantRoutes = require('./tenantRoutes');
const visitorRoutes = require('./visitorRoutes');
const complaintRoutes = require('./complaintRoutes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes); // FR-02 (#3)
router.use('/flats', flatRoutes); // FR-12 (#7)
router.use('/tenants', tenantRoutes); // FR-01 (#8)
router.use('/visitors', visitorRoutes); // FR-08 (#13)
router.use('/complaints', complaintRoutes); // FR-13 (#14)

module.exports = router;
