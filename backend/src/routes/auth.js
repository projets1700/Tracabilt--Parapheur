const router = require('express').Router();
const { connexionAdmin, connexionScanner, moi } = require('../controllers/authController');
const { verifierToken } = require('../middleware/auth');
const { reglesConnexionAdmin, reglesConnexionScanner } = require('../middleware/validation');
const { limiterAuth } = require('../middleware/rateLimiter');

router.post('/admin/connexion',   limiterAuth, reglesConnexionAdmin,   connexionAdmin);
router.post('/scanner/connexion', limiterAuth, reglesConnexionScanner, connexionScanner);
router.get('/moi', verifierToken, moi);

module.exports = router;