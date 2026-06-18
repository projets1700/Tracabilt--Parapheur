const pool = require('../config/db');

async function listerParapheurs(req, res) {
  const { statut, recherche, page = 1, limite = 20 } = req.query;
  const offset = (page - 1) * limite;
  const conditions = [];
  const params = [];

  if (statut) {
    params.push(statut);
    conditions.push(`p.statut = $${params.length}`);
  }
  if (recherche) {
    params.push(`%${recherche}%`);
    conditions.push(`(p.numero ILIKE $${params.length} OR p.titre ILIKE $${params.length})`);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  params.push(limite, offset);

  try {
    const result = await pool.query(`
      SELECT p.*,
        (SELECT scanned_at FROM scans WHERE parapheur_id = p.id ORDER BY scanned_at DESC LIMIT 1) AS dernier_scan,
        (SELECT s.nom FROM scans sc JOIN scanners s ON sc.scanner_id = s.id WHERE sc.parapheur_id = p.id ORDER BY sc.scanned_at DESC LIMIT 1) AS dernier_operateur
      FROM parapheurs p ${where}
      ORDER BY p.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const total = await pool.query(
      `SELECT COUNT(*) FROM parapheurs p ${where}`,
      params.slice(0, params.length - 2)
    );

    res.json({
      parapheurs: result.rows,
      total: parseInt(total.rows[0].count),
      page: parseInt(page),
      limite: parseInt(limite),
    });
  } catch (err) {
    console.error('Erreur listing parapheurs :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function obtenirParapheur(req, res) {
  const { numero } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM parapheurs WHERE numero = $1',
      [numero.toUpperCase()]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Parapheur introuvable.' });
    }
    const parapheur = result.rows[0];
    const scans = await pool.query(`
      SELECT sc.*, s.nom AS operateur_nom, l.nom_lieu
      FROM scans sc
      LEFT JOIN scanners s ON sc.scanner_id = s.id
      LEFT JOIN lieux l ON sc.lieu_id = l.id
      WHERE sc.parapheur_id = $1
      ORDER BY sc.scanned_at DESC
      LIMIT 50
    `, [parapheur.id]);
    res.json({ ...parapheur, scans: scans.rows });
  } catch (err) {
    console.error('Erreur obtention parapheur :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function creerParapheur(req, res) {
  const { numero, titre } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO parapheurs (numero, titre) VALUES ($1, $2) RETURNING *',
      [numero.toUpperCase().trim(), titre.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Ce numéro existe déjà.' });
    }
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function mettreAJourParapheur(req, res) {
  const { id } = req.params;
  const { titre, statut, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE parapheurs
       SET titre     = COALESCE($1, titre),
           statut    = COALESCE($2, statut),
           is_active = COALESCE($3, is_active)
       WHERE id = $4 RETURNING *`,
      [titre, statut, is_active, id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Parapheur introuvable.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function supprimerParapheur(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM parapheurs WHERE id = $1 RETURNING id',
      [id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Parapheur introuvable.' });
    }
    res.json({ message: 'Parapheur supprimé.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

module.exports = { listerParapheurs, obtenirParapheur, creerParapheur, mettreAJourParapheur, supprimerParapheur };