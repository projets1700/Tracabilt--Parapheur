const router = require('express').Router();
const { enregistrerScan, synchroniserScans, listerScans } = require('../controllers/scansController');
const { exigerScanner, exigerAdmin } = require('../middleware/auth');
const { reglesScan } = require('../middleware/validation');

router.post('/',     exigerScanner, reglesScan, enregistrerScan);
router.post('/sync', exigerScanner, synchroniserScans);
router.get('/',      exigerAdmin,   listerScans);

module.exports = router;