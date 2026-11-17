/**
 * API REST du module documentaire (cahier des charges §5.3).
 */
const router = require('express').Router();
const multer = require('multer');
const exigerUtilisateur = require('../middleware/exigerUtilisateurDocuments');
const { limiterAPI, limiterConversion, limiterNumeros } = require('../middleware/rateLimiter');
const service = require('../documents/documentsService');

/* Réception du fichier en mémoire, limitée à la taille configurée. */
async function televerser(req, res, next) {
  const { taille_max_octets: max } = await service.obtenirConfig();
  multer({ storage: multer.memoryStorage(), limits: { fileSize: max, files: 1, fields: 10 } })
    .single('fichier')(req, res, err => {
      if (err?.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: `Le fichier dépasse la taille maximale autorisée (${Math.round(max / 1024 / 1024 * 10) / 10} Mo).` });
      }
      if (err) return res.status(400).json({ message: "Envoi du fichier impossible (un seul fichier, champ « fichier »)." });
      next();
    });
}

/** Les navigateurs envoient le nom en UTF-8, que multer décode en latin-1. */
function nomFichier(f) {
  const brut = f.originalname || 'document';
  const utf8 = Buffer.from(brut, 'latin1').toString('utf8');
  return utf8.includes('\uFFFD') ? brut : utf8;
}

function encoderNom(nom) {
  const ascii = nom.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nom)}`;
}

/* ---------- Route publique : conversion Word / ODT → PDF ----------
 * Pour les visiteurs non connectés du Visionneur : le fichier est converti puis
 * renvoyé ; rien n'est conservé sur le serveur (fichiers temporaires supprimés). */
router.post('/conversion-pdf', limiterConversion, televerser, async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu.' });
  const { pdf, nom } = await service.convertirEnPdf(nomFichier(req.file), req.file.buffer);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': encoderNom(nom),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(pdf);
});

/* ---------- Routes publiques : noms des QR codes ----------
 * Le nom d'un QR code est choisi par l'utilisateur et doit être unique. */

// Suggestion d'un nom libre (DEP-000001, DEP-000002…), rien n'est réservé.
router.get('/noms-qr/suggestion', limiterNumeros, async (req, res) => {
  res.json({ nom: await service.suggererNom() });
});

// Visiteur non connecté : réserve un nom ; renvoie une clé pour pouvoir le libérer.
router.post('/noms-qr', limiterNumeros, async (req, res) => {
  const { numero, cle } = await service.reserverNomVisiteur(req.body?.nom);
  res.status(201).json({ nom: numero, cle });
});

// Visiteur : libère un nom réservé (QR code supprimé ou renommé), avec sa clé.
router.delete('/noms-qr/:nom', limiterNumeros, async (req, res) => {
  await service.libererNomVisiteur(req.params.nom, req.get('X-Cle-Nom'));
  res.status(204).end();
});

/* ---------- Toutes les autres routes : administrateur ou superviseur ---------- */
router.use(limiterAPI, exigerUtilisateur);

/* ---------- Configuration ---------- */
router.get('/config', async (req, res) => {
  res.json(await service.obtenirConfig());
});

router.put('/config', exigerUtilisateur.admin, async (req, res) => {
  res.json(await service.modifierConfig(req.body || {}));
});

/* ---------- Documents ---------- */
router.get('/', async (req, res) => {
  res.json({ documents: await service.lister({ parapheurId: req.query.parapheur_id }) });
});

router.post('/', televerser, async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu.' });
  const document = await service.importer({
    nomFichier: nomFichier(req.file),
    octets: req.file.buffer,
    parapheurId: req.body?.parapheur_id || null,
    utilisateur: req.utilisateur,
  });
  res.status(201).json({ document });
});

router.get('/:id', async (req, res) => {
  res.json(await service.obtenir(req.params.id));
});

router.put('/:id', async (req, res) => {
  res.json(await service.modifier(req.params.id, req.body || {}, req.utilisateur));
});

router.delete('/:id', exigerUtilisateur.admin, async (req, res) => {
  await service.supprimer(req.params.id);
  res.status(204).end();
});

router.get('/:id/preview', async (req, res) => {
  const octets = await service.apercu(req.params.id);
  res.set({ 'Content-Type': 'application/pdf', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  res.send(octets);
});

/* ---------- QR codes ---------- */
router.post('/:id/qrcodes', async (req, res) => {
  res.status(201).json({ qrcode: await service.creerQr(req.params.id, req.body || {}, req.utilisateur) });
});

router.put('/:id/qrcodes/:qrId', async (req, res) => {
  res.json({ qrcode: await service.modifierQr(req.params.id, req.params.qrId, req.body || {}, req.utilisateur) });
});

router.delete('/:id/qrcodes/:qrId', async (req, res) => {
  await service.supprimerQr(req.params.id, req.params.qrId, req.utilisateur);
  res.status(204).end();
});

/* ---------- Génération, export, historique ---------- */
router.post('/:id/generate', async (req, res) => {
  req.setTimeout?.(10 * 60 * 1000);
  const document = await service.generer(req.params.id, String(req.body?.format || '').toLowerCase(), req.utilisateur);
  res.json({ document });
});

router.get('/:id/export', async (req, res) => {
  const version = req.query.version === 'original' ? 'original' : 'genere';
  const { octets, nom, mime } = await service.exporter(req.params.id, version, req.utilisateur);
  res.set({
    'Content-Type': mime,
    'Content-Disposition': encoderNom(nom),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Expose-Headers': 'Content-Disposition',
  });
  res.send(octets);
});

router.get('/:id/history', async (req, res) => {
  res.json({ historique: await service.historique(req.params.id) });
});

/* ---------- Gestion des erreurs ---------- */
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof service.ErreurMetier) {
    return res.status(err.statut).json({ message: err.message });
  }
  if (err?.code === 'ENOENT') {
    console.error('Fichier documentaire manquant :', err.path);
    return res.status(500).json({ message: 'Le fichier est introuvable dans le stockage. Contactez un administrateur.' });
  }
  console.error('Erreur module documentaire :', err);
  res.status(500).json({ message: 'Erreur serveur.' });
});

module.exports = router;
