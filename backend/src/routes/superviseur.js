const express = require('express');
const ctrl = require('../controllers/superviseurController');

const router = express.Router();

router.get('/existe',       ctrl.superviseurExiste);
router.post('/inscription', ctrl.inscription);
router.post('/connexion',   ctrl.connexion);

module.exports = router;
