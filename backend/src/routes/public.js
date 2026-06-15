const router = require('express').Router();
const { rechercherParapheur, historiqueParapheur } = require('../controllers/publicController');

// Aucune authentification requise — accès libre visiteur
router.get('/parapheurs/:numero', rechercherParapheur);
router.get('/parapheurs/:numero/historique', historiqueParapheur);

module.exports = router;
