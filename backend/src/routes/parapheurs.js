const router = require('express').Router();
const { listerParapheurs, obtenirParapheur, creerParapheur, mettreAJourParapheur, supprimerParapheur } = require('../controllers/parapheursController');
const { exigerAdmin } = require('../middleware/auth');

// Accessible sans compte (visionneur)
router.get('/', listerParapheurs);
router.get('/:reference', obtenirParapheur);

// Réservé aux administrateurs
router.post('/', exigerAdmin, creerParapheur);
router.put('/:id', exigerAdmin, mettreAJourParapheur);
router.delete('/:id', exigerAdmin, supprimerParapheur);

module.exports = router;
