
const express = require('express');
const { createVisitor, listVisitors } = require('../controllers/visitorController');

const router = express.Router();

router.post('/', createVisitor);
router.get('/', listVisitors);

module.exports = router;
