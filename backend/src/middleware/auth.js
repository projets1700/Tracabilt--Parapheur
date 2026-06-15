const jwt = require('jsonwebtoken');

function verifierToken(req, res, next) {
  const entete = req.headers.authorization;
  if (!entete || !entete.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Accès refusé. Token manquant.' });
  }
  const token = entete.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.utilisateur = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Token invalide ou expiré.' });
  }
}

function exigerRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.utilisateur?.role)) {
      return res.status(403).json({ message: 'Accès interdit. Droits insuffisants.' });
    }
    next();
  };
}

const exigerAdmin   = [verifierToken, exigerRole('administrateur')];
const exigerScanner = [verifierToken, exigerRole('operateur')];
const exigerConnecte = [verifierToken, exigerRole('administrateur', 'operateur')];

module.exports = { verifierToken, exigerRole, exigerAdmin, exigerScanner, exigerConnecte };
