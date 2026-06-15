const router = require('express').Router();
const { enregistrerScan, synchroniserScans, listerEvenements } = require('../controllers/evenementsController');
const { exigerScanner, exigerAdmin } = require('../middleware/auth');
const { reglesScan } = require('../middleware/validation');

router.post('/scan', exigerScanner, reglesScan, enregistrerScan);
router.post('/sync', exigerScanner, synchroniserScans);
router.get('/', exigerAdmin, listerEvenements);

module.exports = router;