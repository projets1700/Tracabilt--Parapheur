/**
 * API du module documentaire.
 *
 * Aucun document ni QR code n'est conservé sur le serveur : le navigateur fait
 * tout le travail. Le serveur garantit seulement l'unicité des noms de QR codes
 * et convertit les documents Word / OpenDocument en PDF (sans les conserver).
 * Routes publiques (accessibles depuis le Visionneur sans connexion), limitées
 * en fréquence.
 */
const router = require('express').Router();
const multer = require('multer');
const { limiterConversion, limiterNumeros } = require('../middleware/rateLimiter');
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

/* ---------- Conversion Word / ODT → PDF (rien n'est conservé) ---------- */
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

/* ---------- Noms des QR codes : uniques ---------- */

// Suggestion d'un nom libre (DEP-000001, DEP-000002…), rien n'est réservé.
router.get('/noms-qr/suggestion', limiterNumeros, async (req, res) => {
  res.json({ nom: await service.suggererNom() });
});

// Réservation d'un nom (refusé s'il est déjà utilisé) ; renvoie une clé pour pouvoir le libérer.
router.post('/noms-qr', limiterNumeros, async (req, res) => {
  const { numero, cle } = await service.reserverNom(req.body?.nom);
  res.status(201).json({ nom: numero, cle });
});

// Libération d'un nom (QR code supprimé avant d'avoir servi), avec sa clé.
router.delete('/noms-qr/:nom', limiterNumeros, async (req, res) => {
  await service.libererNom(req.params.nom, req.get('X-Cle-Nom'));
  res.status(204).end();
});

/* ---------- Gestion des erreurs ---------- */
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof service.ErreurMetier) {
    return res.status(err.statut).json({ message: err.message });
  }
  console.error('Erreur module documentaire :', err);
  res.status(500).json({ message: 'Erreur serveur.' });
});

module.exports = router;
