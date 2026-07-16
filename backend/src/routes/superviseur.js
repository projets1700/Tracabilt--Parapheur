const express = require('express');
const ctrl = require('../controllers/superviseurController');

const router = express.Router();

router.post('/connexion', ctrl.connexion);

module.exports = router;
