const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

function signerToken(utilisateur) {
  return jwt.sign(
    { id: utilisateur.id, email: utilisateur.email, role: utilisateur.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function connexion(req, res) {
  const { email, mot_de_passe } = req.body;
  if (!email || !mot_de_passe) {
    return res.status(400).json({ message: 'Email et mot de passe obligatoires.' });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM utilisateurs WHERE email = $1 AND actif = TRUE',
      [email.toLowerCase().trim()]
    );
    const utilisateur = result.rows[0];
    if (!utilisateur || !(await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe))) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }
    const { mot_de_passe: _, ...donnees } = utilisateur;
    res.json({ token: signerToken(utilisateur), utilisateur: donnees });
  } catch (err) {
    console.error('Erreur connexion :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function connexionAdmin(req, res) {
  const { email, mot_de_passe } = req.body;
  if (!email || !mot_de_passe) {
    return res.status(400).json({ message: 'Email et mot de passe obligatoires.' });
  }
  try {
    const result = await pool.query(
      "SELECT * FROM utilisateurs WHERE email = $1 AND role = 'administrateur' AND actif = TRUE",
      [email.toLowerCase().trim()]
    );
    const utilisateur = result.rows[0];
    if (!utilisateur || !(await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe))) {
      return res.status(401).json({ message: 'Identifiants incorrects ou accès non autorisé.' });
    }
    const { mot_de_passe: _, ...donnees } = utilisateur;
    res.json({ token: signerToken(utilisateur), utilisateur: donnees });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function connexionScanner(req, res) {
  const { email, mot_de_passe } = req.body;
  if (!email || !mot_de_passe) {
    return res.status(400).json({ message: 'Email et mot de passe obligatoires.' });
  }
  try {
    const result = await pool.query(
      "SELECT * FROM utilisateurs WHERE email = $1 AND role = 'operateur' AND actif = TRUE",
      [email.toLowerCase().trim()]
    );
    const utilisateur = result.rows[0];
    if (!utilisateur || !(await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe))) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }
    const { mot_de_passe: _, ...donnees } = utilisateur;
    res.json({ token: signerToken(utilisateur), utilisateur: donnees });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function moi(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, nom, prenom, email, role, actif, cree_le FROM utilisateurs WHERE id = $1',
      [req.utilisateur.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Utilisateur introuvable.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

module.exports = { connexion, connexionAdmin, connexionScanner, moi };