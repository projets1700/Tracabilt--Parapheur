const router = require('express').Router();
const { listerParapheurs, obtenirParapheur, creerParapheur, mettreAJourParapheur, supprimerParapheur } = require('../controllers/parapheursController');
const { exigerAdmin } = require('../middleware/auth');
const { reglesCreerParapheur, reglesModifierParapheur } = require('../middleware/validation');

router.get('/', listerParapheurs);
router.get('/:numero', obtenirParapheur);

router.post('/',    exigerAdmin, reglesCreerParapheur,    creerParapheur);
router.put('/:id',  exigerAdmin, reglesModifierParapheur, mettreAJourParapheur);
router.delete('/:id', exigerAdmin, supprimerParapheur);

module.exports = router;