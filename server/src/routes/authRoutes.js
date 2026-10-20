const express = require('express');
const { login } = require('../controllers/authController');

const router = express.Router();

router.post('/login', login); // Public (SAD §3.2), FR-02

module.exports = router;
