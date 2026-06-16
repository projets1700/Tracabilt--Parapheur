const pool = require('../config/db');

async function enregistrerScan(req, res) {
  const { parapheur_numero, latitude, longitude, precision_gps, scanned_at } = req.body;
  try {
    const numero = parapheur_numero.toUpperCase().trim();

    // Crée le parapheur s'il n'existe pas encore
    await pool.query(
      `INSERT INTO parapheurs (numero, titre) VALUES ($1, $1)
       ON CONFLICT (numero) DO NOTHING`,
      [numero]
    );

    const parapheur = await pool.query(
      'SELECT id FROM parapheurs WHERE numero = $1',
      [numero]
    );

    const result = await pool.query(`
      INSERT INTO scans (parapheur_id, scanner_id, latitude, longitude, precision_gps, scanned_at, sync_status)
      VALUES ($1, $2, $3, $4, $5, $6, 'synchronise') RETURNING *
    `, [
      parapheur.rows[0].id,
      req.utilisateur.id,
      latitude || null,
      longitude || null,
      precision_gps || null,
      scanned_at ? new Date(scanned_at) : new Date(),
    ]);

    res.status(201).json(result.rows[0]);
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
      const numero = scan.parapheur_numero?.toUpperCase().trim();
      await pool.query(
        `INSERT INTO parapheurs (numero, titre) VALUES ($1, $1) ON CONFLICT (numero) DO NOTHING`,
        [numero]
      );
      const parapheur = await pool.query(
        'SELECT id FROM parapheurs WHERE numero = $1',
        [numero]
      );
      if (!parapheur.rows[0]) {
        resultats.push({ numero: scan.parapheur_numero, succes: false, message: 'Erreur serveur.' });
        continue;
      }
      await pool.query(`
        INSERT INTO scans (parapheur_id, scanner_id, latitude, longitude, precision_gps, scanned_at, sync_status)
        VALUES ($1, $2, $3, $4, $5, $6, 'synchronise')
      `, [
        parapheur.rows[0].id,
        req.utilisateur.id,
        scan.latitude || null,
        scan.longitude || null,
        scan.precision_gps || null,
        scan.scanned_at ? new Date(scan.scanned_at) : new Date(),
      ]);
      resultats.push({ numero: scan.parapheur_numero, succes: true });
    } catch {
      resultats.push({ numero: scan.parapheur_numero, succes: false, message: 'Erreur insertion.' });
    }
  }

  const ok = resultats.filter(r => r.succes).length;
  res.json({ synchronises: ok, total: scans.length, resultats });
}

async function listerScans(req, res) {
  const { parapheur_id, scanner_id, page = 1, limite = 50 } = req.query;
  const offset = (page - 1) * limite;
  const conditions = [];
  const params = [];

  if (parapheur_id) {
    params.push(parapheur_id);
    conditions.push(`sc.parapheur_id = $${params.length}`);
  }
  if (scanner_id) {
    params.push(scanner_id);
    conditions.push(`sc.scanner_id = $${params.length}`);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  params.push(limite, offset);

  try {
    const result = await pool.query(`
      SELECT sc.*, p.numero AS parapheur_numero, p.titre AS parapheur_titre, s.nom AS operateur_nom
      FROM scans sc
      JOIN parapheurs p ON sc.parapheur_id = p.id
      LEFT JOIN scanners s ON sc.scanner_id = s.id
      ${where}
      ORDER BY sc.scanned_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const total = await pool.query(
      `SELECT COUNT(*) FROM scans sc ${where}`,
      params.slice(0, params.length - 2)
    );

    res.json({
      scans: result.rows,
      total: parseInt(total.rows[0].count),
      page: parseInt(page),
      limite: parseInt(limite),
    });
  } catch (err) {
    console.error('Erreur listing scans :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

module.exports = { enregistrerScan, synchroniserScans, listerScans };