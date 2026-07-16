const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

function signerToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

async function connexion(req, res) {
  try {
    const { identifiant, mot_de_passe } = req.body;
    if (!identifiant || !mot_de_passe) {
      return res.status(400).json({ message: 'Identifiant et mot de passe requis.' });
    }
    const r = await pool.query('SELECT * FROM superviseurs WHERE identifiant = $1', [identifiant.trim().toLowerCase()]);
    const sup = r.rows[0];
    if (!sup || !(await bcrypt.compare(mot_de_passe, sup.password_hash))) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }
    const token = signerToken({ id: sup.id, nom: sup.nom, identifiant: sup.identifiant, role: 'superviseur' });
    res.json({ token, utilisateur: { id: sup.id, nom: sup.nom, identifiant: sup.identifiant, role: 'superviseur' } });
  } catch (err) {
    console.error('connexion superviseur :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

module.exports = { connexion };
