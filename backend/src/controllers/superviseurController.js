const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

function signerToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

async function superviseurExiste(req, res) {
  try {
    const r = await pool.query('SELECT COUNT(*) FROM superviseurs');
    res.json({ existe: parseInt(r.rows[0].count, 10) > 0 });
  } catch (err) {
    console.error('superviseurExiste :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function inscription(req, res) {
  try {
    const r = await pool.query('SELECT COUNT(*) FROM superviseurs');
    if (parseInt(r.rows[0].count, 10) > 0) {
      return res.status(409).json({ message: 'Un superviseur existe déjà.' });
    }
    const { nom, identifiant, mot_de_passe } = req.body;
    if (!nom || !identifiant || !mot_de_passe) {
      return res.status(400).json({ message: 'Tous les champs sont obligatoires.' });
    }
    if (mot_de_passe.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }
    const hash = await bcrypt.hash(mot_de_passe, 10);
    const ins = await pool.query(
      'INSERT INTO superviseurs (nom, identifiant, password_hash) VALUES ($1, $2, $3) RETURNING id, nom, identifiant',
      [nom.trim(), identifiant.trim().toLowerCase(), hash]
    );
    const sup = ins.rows[0];
    const token = signerToken({ id: sup.id, nom: sup.nom, identifiant: sup.identifiant, role: 'superviseur' });
    res.status(201).json({ token, utilisateur: { ...sup, role: 'superviseur' } });
  } catch (err) {
    console.error('inscription superviseur :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
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

module.exports = { superviseurExiste, inscription, connexion };
