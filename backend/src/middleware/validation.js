const { body, param, query, validationResult } = require('express-validator');

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

const reglesConnexion = [
  body('email').isEmail().withMessage('Email invalide.').normalizeEmail(),
  body('mot_de_passe').isLength({ min: 1 }).withMessage('Mot de passe requis.'),
  verifierValidation,
];

const reglesCreerParapheur = [
  body('reference')
    .trim().notEmpty().withMessage('La référence est obligatoire.')
    .matches(/^[A-Z0-9\-]+$/i).withMessage('Référence invalide (lettres, chiffres, tirets uniquement).'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description trop longue.'),
  verifierValidation,
];

const reglesModifierParapheur = [
  body('statut').optional().isIn(['en_transit', 'livre', 'en_attente', 'archive']).withMessage('Statut invalide.'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description trop longue.'),
  param('id').isUUID().withMessage('Identifiant invalide.'),
  verifierValidation,
];

const reglesCreerUtilisateur = [
  body('nom').trim().notEmpty().withMessage('Le nom est obligatoire.').isLength({ max: 100 }),
  body('prenom').trim().notEmpty().withMessage('Le prénom est obligatoire.').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Email invalide.').normalizeEmail(),
  body('mot_de_passe').isLength({ min: 6 }).withMessage('Le mot de passe doit faire au moins 6 caractères.'),
  body('role').isIn(['administrateur', 'operateur']).withMessage('Rôle invalide.'),
  verifierValidation,
];

const reglesScan = [
  body('parapheur_reference').trim().notEmpty().withMessage('Référence du parapheur obligatoire.'),
  body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }).withMessage('Latitude invalide.'),
  body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }).withMessage('Longitude invalide.'),
  body('precision_gps').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Précision GPS invalide.'),
  verifierValidation,
];

module.exports = {
  reglesConnexion,
  reglesCreerParapheur,
  reglesModifierParapheur,
  reglesCreerUtilisateur,
  reglesScan,
};