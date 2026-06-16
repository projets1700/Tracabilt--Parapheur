const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function listerScanners(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, nom, identifiant, device_id, is_active, created_at FROM scanners ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function creerScanner(req, res) {
  const { nom, identifiant, mot_de_passe, device_id } = req.body;
  try {
    const hash = await bcrypt.hash(mot_de_passe, 10);
    const result = await pool.query(
      'INSERT INTO scanners (nom, identifiant, password_hash, device_id) VALUES ($1, $2, $3, $4) RETURNING id, nom, identifiant, device_id, is_active, created_at',
      [nom.trim(), identifiant.trim(), hash, device_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Cet identifiant est déjà utilisé.' });
    }
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function mettreAJourScanner(req, res) {
  const { id } = req.params;
  const { nom, device_id, is_active, mot_de_passe } = req.body;
  try {
    const hash = mot_de_passe ? await bcrypt.hash(mot_de_passe, 10) : undefined;
    const result = await pool.query(
      `UPDATE scanners SET
        nom           = COALESCE($1, nom),
        device_id     = COALESCE($2, device_id),
        is_active     = COALESCE($3, is_active),
        password_hash = COALESCE($4, password_hash)
       WHERE id = $5 RETURNING id, nom, identifiant, device_id, is_active, created_at`,
      [nom, device_id, is_active, hash, id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Scanner introuvable.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function supprimerScanner(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE scanners SET is_active = FALSE WHERE id = $1 RETURNING id',
      [id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Scanner introuvable.' });
    }
    res.json({ message: 'Scanner désactivé.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function statistiques(req, res) {
  try {
    const [parapheursActifs, scansAujourdhui, scannersActifs, totalScans] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM parapheurs WHERE is_active = TRUE AND statut = 'en_circulation'"),
      pool.query("SELECT COUNT(*) FROM scans WHERE scanned_at::date = CURRENT_DATE"),
      pool.query("SELECT COUNT(DISTINCT scanner_id) FROM scans WHERE scanned_at::date = CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM scans"),
    ]);
    res.json({
      parapheurs_actifs: parseInt(parapheursActifs.rows[0].count),
      scans_aujourdhui: parseInt(scansAujourdhui.rows[0].count),
      operateurs_actifs: parseInt(scannersActifs.rows[0].count),
      total_scans: parseInt(totalScans.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

module.exports = { listerScanners, creerScanner, mettreAJourScanner, supprimerScanner, statistiques };