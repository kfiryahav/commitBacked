const express = require('express');
const router = express.Router();
const creativeController = require('../controllers/creativeController');

router.post('/analyzeProduct', creativeController.analyzeProduct);

module.exports = router;
