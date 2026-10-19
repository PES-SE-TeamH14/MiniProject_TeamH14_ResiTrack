const express = require('express');
const healthRoutes = require('./healthRoutes');

const router = express.Router();

router.use('/health', healthRoutes);

// Feature routes are mounted here as each backlog item is built, for example:
// router.use('/auth', authRoutes);        // FR-02  (#3)
// router.use('/flats', flatRoutes);       // FR-12  (#7)
// router.use('/tenants', tenantRoutes);   // FR-01  (#8)

module.exports = router;
