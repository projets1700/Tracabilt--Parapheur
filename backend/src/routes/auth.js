const router = require('express').Router();
const { connexion, connexionAdmin, connexionScanner, moi } = require('../controllers/authController');
const { verifierToken } = require('../middleware/auth');

// Connexion générale (tous rôles)
router.post('/connexion', connexion);

// Connexion spécifique admin
router.post('/admin/connexion', connexionAdmin);

// Connexion spécifique scanner (opérateur)
router.post('/scanner/connexion', connexionScanner);

// Profil de l'utilisateur connecté
router.get('/moi', verifierToken, moi);

module.exports = router;
