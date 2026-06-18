const router = require('express').Router();
const { listerParapheurs, obtenirParapheur, creerParapheur, mettreAJourParapheur, supprimerParapheur } = require('../controllers/parapheursController');
const { exigerScanner } = require('../middleware/auth');
const { reglesCreerParapheur, reglesModifierParapheur } = require('../middleware/validation');

router.get('/', listerParapheurs);
router.get('/:numero', obtenirParapheur);

router.post('/',      exigerScanner, reglesCreerParapheur,    creerParapheur);
router.put('/:id',    exigerScanner, reglesModifierParapheur, mettreAJourParapheur);
router.delete('/:id', exigerScanner, supprimerParapheur);

module.exports = router;