const jwt = require('jsonwebtoken');

/**
 * Accès au module documentaire : administrateurs et superviseurs (CDC §7.2).
 * `exigerUtilisateurDocuments.admin` restreint aux administrateurs.
 */
function verifier(rolesAutorises) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token manquant.' });
    }
    try {
      const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
      if (!rolesAutorises.includes(payload.role)) {
        return res.status(403).json({ message: 'Accès réservé aux administrateurs et superviseurs.' });
      }
      req.utilisateur = payload;
      next();
    } catch {
      return res.status(401).json({ message: 'Token invalide ou expiré.' });
    }
  };
}

const exigerUtilisateurDocuments = verifier(['admin', 'superviseur']);
exigerUtilisateurDocuments.admin = verifier(['admin']);

module.exports = exigerUtilisateurDocuments;
