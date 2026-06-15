const router = require('express').Router();
const { connexion, connexionAdmin, connexionScanner, moi } = require('../controllers/authController');
const { verifierToken } = require('../middleware/auth');
const { reglesConnexion } = require('../middleware/validation');
const { limiterAuth } = require('../middleware/rateLimiter');

router.post('/connexion',         limiterAuth, reglesConnexion, connexion);
router.post('/admin/connexion',   limiterAuth, reglesConnexion, connexionAdmin);
router.post('/scanner/connexion', limiterAuth, reglesConnexion, connexionScanner);
router.get('/moi', verifierToken, moi);

module.exports = router;