const express = require('express');
const ctrl = require('../controllers/superviseurController');
const exigerSuperviseur = require('../middleware/exigerSuperviseur');

const router = express.Router();

router.post('/connexion', ctrl.connexion);
router.put('/moi',        exigerSuperviseur, ctrl.changerIdentifiants);

module.exports = router;
