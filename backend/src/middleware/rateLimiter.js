const rateLimit = require('express-rate-limit');

// Les tests automatisés (NODE_ENV=test, défini par Jest) ne sont pas limités.
const horsTests = () => process.env.NODE_ENV === 'test';

const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Conversion publique Word/ODT → PDF (visiteurs non connectés) : coûteuse, donc limitée.
const limiterConversion = rateLimit({
  skip: horsTests,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: 'Trop de conversions de documents. Réessayez dans quelques minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Noms des QR codes (suggestion, réservation, libération).
const limiterNumeros = rateLimit({
  skip: horsTests,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  message: { message: 'Trop de QR codes créés. Réessayez dans quelques minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { limiterAuth, limiterConversion, limiterNumeros };
