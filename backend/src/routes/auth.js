const router = require('express').Router();
const { connexion, connexionAdmin, connexionScanner, moi } = require('../controllers/authController');
const { verifierToken } = require('../middleware/auth');

router.post('/connexion', connexion);
router.post('/admin/connexion', connexionAdmin);
router.post('/scanner/connexion', connexionScanner);
router.get('/moi', verifierToken, moi);

module.exports = router;