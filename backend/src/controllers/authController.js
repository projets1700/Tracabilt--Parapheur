const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

function signerToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

async function connexionAdmin(req, res) {
  const { email, mot_de_passe } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM admins WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const admin = result.rows[0];
    if (!admin || !(await bcrypt.compare(mot_de_passe, admin.password_hash))) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }
    const token = signerToken({ id: admin.id, nom: admin.nom, email: admin.email, role: 'admin' });
    res.json({ token, utilisateur: { id: admin.id, nom: admin.nom, email: admin.email, role: 'admin' } });
  } catch (err) {
    console.error('Erreur connexion admin :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function connexionScanner(req, res) {
  const { identifiant, mot_de_passe } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM scanners WHERE identifiant = $1 AND is_active = TRUE',
      [identifiant.trim()]
    );
    const scanner = result.rows[0];
    if (!scanner || !(await bcrypt.compare(mot_de_passe, scanner.password_hash))) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }
    const token = signerToken({ id: scanner.id, nom: scanner.nom, identifiant: scanner.identifiant, role: 'scanner' });
    res.json({ token, utilisateur: { id: scanner.id, nom: scanner.nom, identifiant: scanner.identifiant, role: 'scanner' } });
  } catch (err) {
    console.error('Erreur connexion scanner :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function moi(req, res) {
  try {
    const { id, role } = req.utilisateur;
    if (role === 'admin') {
      const r = await pool.query('SELECT id, nom, email, created_at FROM admins WHERE id = $1', [id]);
      if (!r.rows[0]) return res.status(404).json({ message: 'Introuvable.' });
      return res.json({ ...r.rows[0], role: 'admin' });
    }
    const r = await pool.query('SELECT id, nom, identifiant, device_id, is_active, created_at FROM scanners WHERE id = $1', [id]);
    if (!r.rows[0]) return res.status(404).json({ message: 'Introuvable.' });
    res.json({ ...r.rows[0], role: 'scanner' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

module.exports = { connexionAdmin, connexionScanner, moi };