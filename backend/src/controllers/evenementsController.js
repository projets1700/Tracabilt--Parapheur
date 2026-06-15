const pool = require('../config/db');

async function enregistrerScan(req, res) {
  const { parapheur_reference, latitude, longitude, precision_gps, localisation_nom, identifiant_appareil } = req.body;

  if (!parapheur_reference) {
    return res.status(400).json({ message: 'Référence du parapheur obligatoire.' });
  }

  try {
    const parapheur = await pool.query(
      'SELECT id FROM parapheurs WHERE reference = $1',
      [parapheur_reference.toUpperCase()]
    );
    if (!parapheur.rows[0]) {
      return res.status(404).json({ message: 'Parapheur introuvable.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const evenement = await client.query(`
        INSERT INTO evenements (parapheur_id, utilisateur_id, type, latitude, longitude, precision_gps, localisation_nom, identifiant_appareil)
        VALUES ($1, $2, 'scan', $3, $4, $5, $6, $7) RETURNING *
      `, [
        parapheur.rows[0].id,
        req.utilisateur?.id || null,
        latitude || null,
        longitude || null,
        precision_gps || null,
        localisation_nom || null,
        identifiant_appareil || null,
      ]);

      await client.query(
        `UPDATE parapheurs SET statut = 'en_transit', mis_a_jour_le = NOW() WHERE id = $1`,
        [parapheur.rows[0].id]
      );

      await client.query('COMMIT');
      res.status(201).json(evenement.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Erreur enregistrement scan :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function synchroniserScans(req, res) {
  const { scans } = req.body;
  if (!Array.isArray(scans) || scans.length === 0) {
    return res.status(400).json({ message: 'Aucun scan à synchroniser.' });
  }

  const resultats = [];
  for (const scan of scans) {
    try {
      const parapheur = await pool.query(
        'SELECT id FROM parapheurs WHERE reference = $1',
        [scan.parapheur_reference?.toUpperCase()]
      );
      if (!parapheur.rows[0]) {
        resultats.push({ reference: scan.parapheur_reference, succes: false, message: 'Parapheur introuvable.' });
        continue;
      }
      await pool.query(`
        INSERT INTO evenements (parapheur_id, utilisateur_id, type, latitude, longitude, precision_gps, localisation_nom, identifiant_appareil, cree_le)
        VALUES ($1, $2, 'scan', $3, $4, $5, $6, $7, $8)
      `, [
        parapheur.rows[0].id,
        req.utilisateur?.id || null,
        scan.latitude || null,
        scan.longitude || null,
        scan.precision_gps || null,
        scan.localisation_nom || null,
        scan.identifiant_appareil || null,
        scan.date_scan ? new Date(scan.date_scan) : new Date(),
      ]);
      resultats.push({ reference: scan.parapheur_reference, succes: true });
    } catch {
      resultats.push({ reference: scan.parapheur_reference, succes: false, message: 'Erreur lors de l\'insertion.' });
    }
  }

  const ok = resultats.filter(r => r.succes).length;
  res.json({ synchronises: ok, total: scans.length, resultats });
}

async function listerEvenements(req, res) {
  const { parapheur_id, type, page = 1, limite = 50 } = req.query;
  const offset = (page - 1) * limite;
  const conditions = [];
  const params = [];

  if (parapheur_id) {
    params.push(parapheur_id);
    conditions.push(`e.parapheur_id = $${params.length}`);
  }
  if (type) {
    params.push(type);
    conditions.push(`e.type = $${params.length}`);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  params.push(limite, offset);

  try {
    const result = await pool.query(`
      SELECT e.*, p.reference AS parapheur_reference, u.prenom || ' ' || u.nom AS operateur_nom
      FROM evenements e
      JOIN parapheurs p ON e.parapheur_id = p.id
      LEFT JOIN utilisateurs u ON e.utilisateur_id = u.id
      ${where}
      ORDER BY e.cree_le DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const total = await pool.query(
      `SELECT COUNT(*) FROM evenements e ${where}`,
      params.slice(0, params.length - 2)
    );

    res.json({ evenements: result.rows, total: parseInt(total.rows[0].count), page: parseInt(page), limite: parseInt(limite) });
  } catch (err) {
    console.error('Erreur listing événements :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

module.exports = { enregistrerScan, synchroniserScans, listerEvenements };
