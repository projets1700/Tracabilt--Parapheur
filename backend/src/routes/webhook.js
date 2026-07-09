const express = require('express');
const ctrl = require('../controllers/adminController');

const router = express.Router();

router.post('/eas-build', ctrl.easWebhook);

module.exports = router;
