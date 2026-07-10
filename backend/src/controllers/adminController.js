const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const APK_PATH = '/app/uploads/app-latest.apk';
const MAX_ADMINS = 2;

function signerToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

async function adminExiste(req, res) {
  try {
    const r = await pool.query('SELECT COUNT(*) FROM admins');
    const nombre = parseInt(r.rows[0].count, 10);
    res.json({ existe: nombre > 0, max_atteint: nombre >= MAX_ADMINS });
  } catch (err) {
    console.error('adminExiste :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function inscription(req, res) {
  try {
    const r = await pool.query('SELECT COUNT(*) FROM admins');
    if (parseInt(r.rows[0].count, 10) >= MAX_ADMINS) {
      return res.status(409).json({ message: `Le nombre maximum d'administrateurs (${MAX_ADMINS}) est atteint.` });
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
      'INSERT INTO admins (nom, identifiant, password_hash) VALUES ($1, $2, $3) RETURNING id, nom, identifiant',
      [nom.trim(), identifiant.trim().toLowerCase(), hash]
    );
    const admin = ins.rows[0];
    const token = signerToken({ id: admin.id, nom: admin.nom, identifiant: admin.identifiant, role: 'admin' });
    res.status(201).json({ token, utilisateur: { ...admin, role: 'admin' } });
  } catch (err) {
    console.error('inscription admin :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function connexion(req, res) {
  try {
    const { identifiant, mot_de_passe } = req.body;
    if (!identifiant || !mot_de_passe) {
      return res.status(400).json({ message: 'Identifiant et mot de passe requis.' });
    }
    const r = await pool.query('SELECT * FROM admins WHERE identifiant = $1', [identifiant.trim().toLowerCase()]);
    const admin = r.rows[0];
    if (!admin || !(await bcrypt.compare(mot_de_passe, admin.password_hash))) {
      return res.status(401).json({ message: 'Identifiants incorrects.' });
    }
    const token = signerToken({ id: admin.id, nom: admin.nom, identifiant: admin.identifiant, role: 'admin' });
    res.json({ token, utilisateur: { id: admin.id, nom: admin.nom, identifiant: admin.identifiant, role: 'admin' } });
  } catch (err) {
    console.error('connexion admin :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function easWebhook(req, res) {
  try {
    const secret = process.env.EAS_WEBHOOK_SECRET;
    const signature = req.headers['expo-signature'];
    if (!secret || !signature || !req.rawBody) {
      return res.status(401).json({ message: 'Signature manquante.' });
    }
    const attendu = crypto.createHmac('sha1', secret).update(req.rawBody).digest('hex');
    const recu = Buffer.from(signature);
    const valide = recu.length === attendu.length && crypto.timingSafeEqual(recu, Buffer.from(attendu));
    if (!valide) {
      return res.status(401).json({ message: 'Signature invalide.' });
    }

    const payload = req.body;
    if (payload.platform !== 'android' || payload.status !== 'finished') {
      return res.status(200).json({ message: 'Ignoré (statut ou plateforme non concernée).' });
    }
    const url = payload.artifacts?.buildUrl;
    if (!url) {
      return res.status(200).json({ message: "Pas d'artefact à récupérer." });
    }

    const dl = await fetch(url);
    if (!dl.ok) {
      throw new Error(`Téléchargement APK échoué : ${dl.status}`);
    }
    const buf = Buffer.from(await dl.arrayBuffer());
    fs.writeFileSync(APK_PATH, buf);
    console.log(`APK mis à jour automatiquement depuis le build EAS ${payload.id}`);
    res.status(200).json({ message: 'APK mis à jour.' });
  } catch (err) {
    console.error('easWebhook :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function listerAdmins(req, res) {
  try {
    const r = await pool.query(
      'SELECT id, nom, identifiant, created_at FROM admins ORDER BY created_at ASC'
    );
    res.json({ admins: r.rows });
  } catch (err) {
    console.error('listerAdmins :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function supprimerAdmin(req, res) {
  try {
    const { id } = req.params;
    if (id === req.utilisateur.id) {
      return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte.' });
    }
    const compte = await pool.query('SELECT COUNT(*) FROM admins');
    if (parseInt(compte.rows[0].count, 10) <= 1) {
      return res.status(400).json({ message: 'Impossible de supprimer le dernier administrateur.' });
    }
    const r = await pool.query('DELETE FROM admins WHERE id = $1 RETURNING id', [id]);
    if (r.rows.length === 0) {
      return res.status(404).json({ message: 'Administrateur introuvable.' });
    }
    res.json({ message: 'Administrateur supprimé.' });
  } catch (err) {
    console.error('supprimerAdmin :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function listerScanners(req, res) {
  try {
    const r = await pool.query(
      'SELECT id, nom, identifiant, device_id, is_active, created_at FROM scanners ORDER BY created_at DESC'
    );
    res.json({ scanners: r.rows });
  } catch (err) {
    console.error('listerScanners :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function genererIdentifiantScanner() {
  const r = await pool.query("SELECT identifiant FROM scanners WHERE identifiant ~ '^Scan[0-9]+$'");
  let max = 0;
  for (const row of r.rows) {
    const n = parseInt(row.identifiant.slice(4), 10);
    if (n > max) max = n;
  }
  return `Scan${max + 1}`;
}

async function creerScanner(req, res) {
  try {
    const { nom, mot_de_passe, device_id } = req.body;
    if (!nom || !mot_de_passe) {
      return res.status(400).json({ message: 'Nom et mot de passe sont obligatoires.' });
    }
    if (!/^\d{4}$/.test(mot_de_passe)) {
      return res.status(400).json({ message: 'Le mot de passe doit être un code à 4 chiffres.' });
    }
    const hash = await bcrypt.hash(mot_de_passe, 10);
    for (let tentative = 0; tentative < 5; tentative++) {
      const identifiant = await genererIdentifiantScanner();
      try {
        const r = await pool.query(
          'INSERT INTO scanners (nom, identifiant, password_hash, device_id) VALUES ($1, $2, $3, $4) RETURNING id, nom, identifiant, device_id, is_active, created_at',
          [nom.trim(), identifiant, hash, device_id?.trim() || null]
        );
        return res.status(201).json({ scanner: r.rows[0] });
      } catch (err) {
        if (err.code === '23505') continue; // identifiant déjà pris entretemps, on réessaie avec le suivant
        throw err;
      }
    }
    res.status(500).json({ message: "Impossible de générer un identifiant unique, réessayez." });
  } catch (err) {
    console.error('creerScanner :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function supprimerScanner(req, res) {
  try {
    const { id } = req.params;
    const r = await pool.query('DELETE FROM scanners WHERE id = $1 RETURNING id', [id]);
    if (r.rows.length === 0) {
      return res.status(404).json({ message: 'Scanner introuvable.' });
    }
    res.json({ message: 'Scanner supprimé.' });
  } catch (err) {
    console.error('supprimerScanner :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function uploadApk(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier reçu.' });
    }
    res.json({ message: 'APK mis en ligne avec succès.' });
  } catch (err) {
    console.error('uploadApk :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function infoApk(req, res) {
  try {
    if (!fs.existsSync(APK_PATH)) {
      return res.json({ disponible: false });
    }
    const stat = fs.statSync(APK_PATH);
    res.json({ disponible: true, taille: stat.size, modifie: stat.mtime });
  } catch (err) {
    console.error('infoApk :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function telechargerApk(req, res) {
  try {
    if (!fs.existsSync(APK_PATH)) {
      return res.status(404).json({ message: 'Aucun APK disponible.' });
    }
    res.download(APK_PATH, 'APK-CoeurTrace.apk');
  } catch (err) {
    console.error('telechargerApk :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function listerSuperviseurs(req, res) {
  try {
    const r = await pool.query(
      'SELECT id, nom, identifiant, premiere_connexion, created_at FROM superviseurs ORDER BY created_at DESC'
    );
    res.json({ superviseurs: r.rows });
  } catch (err) {
    console.error('listerSuperviseurs :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function creerSuperviseur(req, res) {
  try {
    const { nom, identifiant, mot_de_passe } = req.body;
    if (!nom || !identifiant || !mot_de_passe) {
      return res.status(400).json({ message: 'Nom, identifiant et mot de passe sont obligatoires.' });
    }
    const existe = await pool.query('SELECT id FROM superviseurs WHERE identifiant = $1', [identifiant.trim().toLowerCase()]);
    if (existe.rows.length > 0) {
      return res.status(409).json({ message: 'Cet identifiant est déjà utilisé.' });
    }
    const hash = await bcrypt.hash(mot_de_passe, 10);
    const r = await pool.query(
      'INSERT INTO superviseurs (nom, identifiant, password_hash) VALUES ($1, $2, $3) RETURNING id, nom, identifiant, premiere_connexion, created_at',
      [nom.trim(), identifiant.trim().toLowerCase(), hash]
    );
    res.status(201).json({ superviseur: r.rows[0] });
  } catch (err) {
    console.error('creerSuperviseur :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function supprimerSuperviseur(req, res) {
  try {
    const { id } = req.params;
    const r = await pool.query('DELETE FROM superviseurs WHERE id = $1 RETURNING id', [id]);
    if (r.rows.length === 0) {
      return res.status(404).json({ message: 'Superviseur introuvable.' });
    }
    res.json({ message: 'Superviseur supprimé.' });
  } catch (err) {
    console.error('supprimerSuperviseur :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

module.exports = { adminExiste, inscription, connexion, easWebhook, listerAdmins, supprimerAdmin, listerScanners, creerScanner, supprimerScanner, uploadApk, infoApk, telechargerApk, listerSuperviseurs, creerSuperviseur, supprimerSuperviseur };
