'use strict';
const router = require('express').Router();
const { getSummary } = require('../controllers/analyticsController');
const { requireAuth } = require('../middleware/auth');

router.get('/summary', requireAuth('admin'), getSummary);

module.exports = router;
