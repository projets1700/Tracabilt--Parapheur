const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const APK_PATH = path.join(UPLOADS_DIR, 'app-latest.apk');

function signerToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

async function adminExiste(req, res) {
  try {
    const r = await pool.query('SELECT COUNT(*) FROM admins');
    res.json({ existe: parseInt(r.rows[0].count) > 0 });
  } catch {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function inscription(req, res) {
  const { nom, identifiant, mot_de_passe } = req.body;
  if (!nom?.trim() || !identifiant?.trim() || !mot_de_passe) {
    return res.status(400).json({ message: 'Tous les champs sont requis.' });
  }
  try {
    const r = await pool.query('SELECT COUNT(*) FROM admins');
    if (parseInt(r.rows[0].count) > 0) {
      return res.status(403).json({ message: 'Un administrateur existe déjà.' });
    }
    const hash = await bcrypt.hash(mot_de_passe, 12);
    const result = await pool.query(
      'INSERT INTO admins (nom, identifiant, password_hash) VALUES ($1, $2, $3) RETURNING id, nom, identifiant',
      [nom.trim(), identifiant.trim().toLowerCase(), hash]
    );
    const admin = result.rows[0];
    const token = signerToken({ id: admin.id, nom: admin.nom, identifiant: admin.identifiant, role: 'admin' });
    res.status(201).json({ token, utilisateur: { ...admin, role: 'admin' } });
  } catch (err) {
    console.error('Erreur inscription admin :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function connexion(req, res) {
  const { identifiant, mot_de_passe } = req.body;
  if (!identifiant?.trim() || !mot_de_passe) {
    return res.status(400).json({ message: 'Tous les champs sont requis.' });
  }
  try {
    const r = await pool.query('SELECT * FROM admins WHERE identifiant = $1', [identifiant.trim().toLowerCase()]);
    const admin = r.rows[0];
    if (!admin || !(await bcrypt.compare(mot_de_passe, admin.password_hash))) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }
    const token = signerToken({ id: admin.id, nom: admin.nom, identifiant: admin.identifiant, role: 'admin' });
    res.json({ token, utilisateur: { id: admin.id, nom: admin.nom, identifiant: admin.identifiant, role: 'admin' } });
  } catch {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function listerScanners(req, res) {
  try {
    const r = await pool.query(
      'SELECT id, nom, identifiant, device_id, is_active, created_at FROM scanners ORDER BY created_at DESC'
    );
    res.json({ scanners: r.rows });
  } catch {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function creerScanner(req, res) {
  const { nom, identifiant, mot_de_passe, device_id } = req.body;
  if (!nom?.trim() || !identifiant?.trim() || !mot_de_passe) {
    return res.status(400).json({ message: 'Nom, identifiant et mot de passe requis.' });
  }
  try {
    const hash = await bcrypt.hash(mot_de_passe, 10);
    const r = await pool.query(
      `INSERT INTO scanners (nom, identifiant, password_hash, device_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nom, identifiant, device_id, is_active, created_at`,
      [nom.trim(), identifiant.trim().toLowerCase(), hash, device_id?.trim() || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Cet identifiant est déjà utilisé.' });
    }
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function supprimerScanner(req, res) {
  const { id } = req.params;
  try {
    const r = await pool.query('DELETE FROM scanners WHERE id = $1 RETURNING id', [id]);
    if (!r.rows[0]) return res.status(404).json({ message: 'Scanner introuvable.' });
    res.json({ message: 'Scanner supprimé.' });
  } catch {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function uploadApk(req, res) {
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu.' });
  res.json({ message: 'APK mis en ligne avec succès.', nom: req.file.originalname, taille: req.file.size });
}

async function infoApk(req, res) {
  if (!fs.existsSync(APK_PATH)) return res.json({ disponible: false });
  const stat = fs.statSync(APK_PATH);
  res.json({ disponible: true, taille: stat.size, modifie: stat.mtime });
}

function telechargerApk(req, res) {
  if (!fs.existsSync(APK_PATH)) {
    return res.status(404).json({ message: 'Aucun APK disponible.' });
  }
  res.download(APK_PATH, 'TraçaParapheur.apk');
}

module.exports = { adminExiste, inscription, connexion, listerScanners, creerScanner, supprimerScanner, uploadApk, infoApk, telechargerApk };
