const router = require('express').Router();
const { listerUtilisateurs, creerUtilisateur, mettreAJourUtilisateur, supprimerUtilisateur, statistiques } = require('../controllers/utilisateursController');
const { exigerAdmin } = require('../middleware/auth');
const { reglesCreerUtilisateur } = require('../middleware/validation');

router.use(exigerAdmin);

router.get('/statistiques', statistiques);
router.get('/', listerUtilisateurs);
router.post('/', reglesCreerUtilisateur, creerUtilisateur);
router.put('/:id', mettreAJourUtilisateur);
router.delete('/:id', supprimerUtilisateur);

module.exports = router;