const router = require('express').Router();
const { listerScanners, creerScanner, mettreAJourScanner, supprimerScanner, statistiques } = require('../controllers/scannersController');
const { exigerAdmin } = require('../middleware/auth');
const { reglesCreerScanner } = require('../middleware/validation');

router.use(exigerAdmin);

router.get('/statistiques', statistiques);
router.get('/',             listerScanners);
router.post('/',            reglesCreerScanner, creerScanner);
router.put('/:id',          mettreAJourScanner);
router.delete('/:id',       supprimerScanner);

module.exports = router;