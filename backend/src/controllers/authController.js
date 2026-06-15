const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function _connecter(req, res, roleAttendu) {
  const { email, mot_de_passe } = req.body;
  if (!email || !mot_de_passe) {
    return res.status(400).json({ message: 'Email et mot de passe requis.' });
  }
  try {
    const filtre = roleAttendu
      ? 'SELECT * FROM utilisateurs WHERE email = $1 AND actif = TRUE AND role = $2'
      : 'SELECT * FROM utilisateurs WHERE email = $1 AND actif = TRUE';
    const params = roleAttendu ? [email.toLowerCase().trim(), roleAttendu] : [email.toLowerCase().trim()];

    const result = await pool.query(filtre, params);
    const utilisateur = result.rows[0];
    if (!utilisateur) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }
    const valide = await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe);
    if (!valide) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }
    const token = jwt.sign(
      { id: utilisateur.id, email: utilisateur.email, role: utilisateur.role, nom: utilisateur.nom, prenom: utilisateur.prenom },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.json({
      token,
      utilisateur: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        prenom: utilisateur.prenom,
        email: utilisateur.email,
        role: utilisateur.role,
      },
    });
  } catch (err) {
    console.error('Erreur lors de la connexion :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

const connexion        = (req, res) => _connecter(req, res, null);
const connexionAdmin   = (req, res) => _connecter(req, res, 'administrateur');
const connexionScanner = (req, res) => _connecter(req, res, 'operateur');

async function moi(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, nom, prenom, email, role, cree_le FROM utilisateurs WHERE id = $1 AND actif = TRUE',
      [req.utilisateur.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

module.exports = { connexion, connexionAdmin, connexionScanner, moi };
