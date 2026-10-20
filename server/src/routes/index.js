
const express = require('express');
const healthRoutes = require('./healthRoutes');
const flatRoutes = require('./flatRoutes');
const visitorRoutes = require('./visitorRoutes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/flats', flatRoutes); // FR-12 (#7)
router.use('/visitors', visitorRoutes); // FR-08 (#13)

module.exports = router;
