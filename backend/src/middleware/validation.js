const { body, param, validationResult } = require('express-validator');

function verifierValidation(req, res, next) {
  const erreurs = validationResult(req);
  if (!erreurs.isEmpty()) {
    return res.status(400).json({
      message: 'Données invalides.',
      erreurs: erreurs.array().map(e => ({ champ: e.path, message: e.msg })),
    });
  }
  next();
}

const reglesConnexionScanner = [
  body('identifiant').trim().notEmpty().withMessage('Identifiant requis.'),
  body('mot_de_passe').isLength({ min: 1 }).withMessage('Mot de passe requis.'),
  verifierValidation,
];

const reglesCreerParapheur = [
  body('numero')
    .trim().notEmpty().withMessage('Le numéro est obligatoire.')
    .matches(/^[A-Z0-9\-]+$/i).withMessage('Numéro invalide (lettres, chiffres, tirets uniquement).'),
  body('titre').trim().notEmpty().withMessage('Le titre est obligatoire.').isLength({ max: 255 }),
  verifierValidation,
];

const reglesModifierParapheur = [
  body('statut').optional().isIn(['en_circulation', 'archive']).withMessage('Statut invalide.'),
  body('titre').optional().trim().isLength({ max: 255 }).withMessage('Titre trop long.'),
  body('is_active').optional().isBoolean().withMessage('is_active doit être un booléen.'),
  param('id').isUUID().withMessage('Identifiant invalide.'),
  verifierValidation,
];

const reglesScan = [
  body('parapheur_numero').trim().notEmpty().withMessage('Numéro du parapheur obligatoire.'),
  body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }).withMessage('Latitude invalide.'),
  body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }).withMessage('Longitude invalide.'),
  body('precision_gps').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Précision GPS invalide.'),
  body('scanned_at').optional({ nullable: true }).isISO8601().withMessage('Date invalide.'),
  body('lieu.nom_lieu').optional({ nullable: true }).isString().isLength({ max: 255 }).withMessage('Nom du lieu trop long (max 255 caractères).'),
  body('lieu.adresse').optional({ nullable: true }).isString().isLength({ max: 500 }).withMessage('Adresse trop longue.'),
  body('lieu.ville').optional({ nullable: true }).isString().isLength({ max: 100 }).withMessage('Ville trop longue.'),
  body('lieu.code_postal').optional({ nullable: true }).isString().isLength({ max: 20 }).withMessage('Code postal trop long.'),
  body('lieu.pays').optional({ nullable: true }).isString().isLength({ max: 100 }).withMessage('Pays trop long.'),
  verifierValidation,
];

module.exports = {
  reglesConnexionScanner,
  reglesCreerParapheur,
  reglesModifierParapheur,
  reglesScan,
};