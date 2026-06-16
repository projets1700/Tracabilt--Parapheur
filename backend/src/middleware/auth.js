const jwt = require('jsonwebtoken');

function verifierToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant.' });
  }
  const token = header.slice(7);
  try {
    req.utilisateur = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Token invalide ou expiré.' });
  }
}

function exigerAdmin(req, res, next) {
  verifierToken(req, res, () => {
    if (req.utilisateur.role !== 'admin') {
      return res.status(403).json({ message: 'Accès réservé aux administrateurs.' });
    }
    next();
  });
}

function exigerScanner(req, res, next) {
  verifierToken(req, res, () => {
    if (req.utilisateur.role !== 'scanner') {
      return res.status(403).json({ message: 'Accès réservé aux scanners.' });
    }
    next();
  });
}

module.exports = { verifierToken, exigerAdmin, exigerScanner };