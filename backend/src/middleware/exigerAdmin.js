const jwt = require('jsonwebtoken');

function exigerAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant.' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') {
      return res.status(403).json({ message: 'Accès réservé aux administrateurs.' });
    }
    req.utilisateur = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Token invalide ou expiré.' });
  }
}

module.exports = exigerAdmin;
