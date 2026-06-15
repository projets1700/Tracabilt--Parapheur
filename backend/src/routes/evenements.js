const router = require('express').Router();
const { enregistrerScan, synchroniserScans, listerEvenements } = require('../controllers/evenementsController');
const { exigerScanner, exigerAdmin } = require('../middleware/auth');

// Scan unique (opérateur connecté)
router.post('/scan', exigerScanner, enregistrerScan);

// Synchronisation batch hors-ligne (opérateur connecté)
router.post('/sync', exigerScanner, synchroniserScans);

// Journal des événements (admin seulement)
router.get('/', exigerAdmin, listerEvenements);

module.exports = router;
