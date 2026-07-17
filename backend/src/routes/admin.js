const express = require('express');
const multer = require('multer');
const exigerAdmin = require('../middleware/exigerAdmin');
const ctrl = require('../controllers/adminController');

const router = express.Router();

const upload = multer({
  dest: '/app/uploads/',
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.apk')) cb(null, true);
    else cb(new Error('Seuls les fichiers .apk sont acceptés.'));
  },
});

function handleUpload(req, res, next) {
  upload.single('apk')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (req.file) {
      const fs = require('fs');
      fs.renameSync(req.file.path, '/app/uploads/app-latest.apk');
    }
    next();
  });
}

router.get('/existe',           ctrl.adminExiste);
router.post('/inscription',     ctrl.inscription);
router.post('/connexion',       ctrl.connexion);
router.get('/admins',           exigerAdmin, ctrl.listerAdmins);
router.post('/admins',          exigerAdmin, ctrl.creerAdmin);
router.put('/admins/:id',       exigerAdmin, ctrl.modifierAdmin);
router.delete('/admins/:id',    exigerAdmin, ctrl.supprimerAdmin);
router.get('/scanners',         exigerAdmin, ctrl.listerScanners);
router.post('/scanners',        exigerAdmin, ctrl.creerScanner);
router.put('/scanners/:id',     exigerAdmin, ctrl.modifierScanner);
router.delete('/scanners/:id',  exigerAdmin, ctrl.supprimerScanner);
router.post('/apk',             exigerAdmin, handleUpload, ctrl.uploadApk);
router.get('/apk/info',         exigerAdmin, ctrl.infoApk);
router.get('/apk/download',     ctrl.telechargerApk);
router.get('/superviseurs',        exigerAdmin, ctrl.listerSuperviseurs);
router.post('/superviseurs',       exigerAdmin, ctrl.creerSuperviseur);
router.put('/superviseurs/:id',    exigerAdmin, ctrl.modifierSuperviseur);
router.delete('/superviseurs/:id', exigerAdmin, ctrl.supprimerSuperviseur);
router.delete('/scans/:id',        exigerAdmin, ctrl.supprimerScan);

module.exports = router;
