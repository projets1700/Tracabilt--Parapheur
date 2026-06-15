const router = require('express').Router();
const { listerUtilisateurs, creerUtilisateur, mettreAJourUtilisateur, supprimerUtilisateur, statistiques } = require('../controllers/utilisateursController');
const { exigerAdmin } = require('../middleware/auth');

router.use(exigerAdmin);

router.get('/statistiques', statistiques);
router.get('/', listerUtilisateurs);
router.post('/', creerUtilisateur);
router.put('/:id', mettreAJourUtilisateur);
router.delete('/:id', supprimerUtilisateur);

module.exports = router;