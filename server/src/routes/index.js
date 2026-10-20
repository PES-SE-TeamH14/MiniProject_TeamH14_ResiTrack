const express = require('express');
const healthRoutes = require('./healthRoutes');
const flatRoutes = require('./flatRoutes');
const visitorRoutes = require('./visitorRoutes');
const complaintRoutes = require('./complaintRoutes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/flats', flatRoutes); // FR-12 (#7)
router.use('/visitors', visitorRoutes); // FR-08 (#13)
router.use('/complaints', complaintRoutes); // FR-13 (#14)

module.exports = router;