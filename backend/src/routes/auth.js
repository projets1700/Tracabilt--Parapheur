const router = require('express').Router();
const { connexionScanner, moi } = require('../controllers/authController');
const { verifierToken } = require('../middleware/auth');
const { reglesConnexionScanner } = require('../middleware/validation');
const { limiterAuth } = require('../middleware/rateLimiter');

router.post('/scanner/connexion', limiterAuth, reglesConnexionScanner, connexionScanner);
router.get('/moi', verifierToken, moi);

module.exports = router;