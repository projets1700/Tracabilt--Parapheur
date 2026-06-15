const router = require('express').Router();
const { enregistrerScan, synchroniserScans, listerEvenements } = require('../controllers/evenementsController');
const { exigerScanner, exigerAdmin } = require('../middleware/auth');

router.post('/scan', exigerScanner, enregistrerScan);
router.post('/sync', exigerScanner, synchroniserScans);
router.get('/', exigerAdmin, listerEvenements);

module.exports = router;