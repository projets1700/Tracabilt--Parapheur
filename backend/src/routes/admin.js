const router = require('express').Router();
const path = require('path');
const multer = require('multer');
const { exigerAdmin } = require('../middleware/auth');
const {
  adminExiste, inscription, connexion,
  listerScanners, creerScanner, supprimerScanner,
  uploadApk, infoApk, telechargerApk,
} = require('../controllers/adminController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => cb(null, 'app-latest.apk'),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.apk')) cb(null, true);
    else cb(new Error('Seuls les fichiers .apk sont acceptés.'));
  },
  limits: { fileSize: 200 * 1024 * 1024 },
});

router.get('/existe',            adminExiste);
router.post('/inscription',      inscription);
router.post('/connexion',        connexion);
router.get('/scanners',          exigerAdmin, listerScanners);
router.post('/scanners',         exigerAdmin, creerScanner);
router.delete('/scanners/:id',   exigerAdmin, supprimerScanner);
router.post('/apk',              exigerAdmin, upload.single('apk'), uploadApk);
router.get('/apk/info',          exigerAdmin, infoApk);
router.get('/apk/download',      telechargerApk);

module.exports = router;
