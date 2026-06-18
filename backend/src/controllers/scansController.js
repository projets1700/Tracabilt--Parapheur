const pool = require('../config/db');

async function obtenirOuCreerLieu(client, latitude, longitude, lieu) {
  const nomLieu = lieu?.nom_lieu?.trim();
  if (!nomLieu) return null;

  const hasGps = latitude != null && longitude != null;

  // Dédoublonnage : par coordonnées si GPS dispo, par nom sinon
  if (hasGps) {
    const existant = await client.query(
      'SELECT id FROM lieux WHERE latitude = $1 AND longitude = $2 LIMIT 1',
      [latitude, longitude]
    );
    if (existant.rows[0]) return existant.rows[0].id;
  } else {
    const existant = await client.query(
      'SELECT id FROM lieux WHERE nom_lieu = $1 AND latitude IS NULL LIMIT 1',
      [nomLieu]
    );
    if (existant.rows[0]) return existant.rows[0].id;
  }

  const r = await client.query(
    `INSERT INTO lieux (latitude, longitude, nom_lieu, adresse, ville, code_postal, pays)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      hasGps ? latitude : null,
      hasGps ? longitude : null,
      nomLieu,
      lieu.adresse || null,
      lieu.ville || null,
      lieu.code_postal || null,
      lieu.pays || null,
    ]
  );
  return r.rows[0].id;
}

async function enregistrerScan(req, res) {
  const { parapheur_numero, latitude, longitude, precision_gps, lieu, scanned_at } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const numero = parapheur_numero.toUpperCase().trim();

    await client.query(
      'INSERT INTO parapheurs (numero, titre) VALUES ($1, $1) ON CONFLICT (numero) DO NOTHING',
      [numero]
    );
    const parapheur = await client.query('SELECT id FROM parapheurs WHERE numero = $1', [numero]);

    // Cooldown 5 minutes
    const dernierScan = await client.query(
      'SELECT scanned_at FROM scans WHERE parapheur_id = $1 ORDER BY scanned_at DESC LIMIT 1',
      [parapheur.rows[0].id]
    );
    if (dernierScan.rows[0]) {
      const ecouleMs = Date.now() - new Date(dernierScan.rows[0].scanned_at).getTime();
      const cinqMinutes = 5 * 60 * 1000;
      if (ecouleMs < cinqMinutes) {
        const resteSecondes = Math.ceil((cinqMinutes - ecouleMs) / 1000);
        const min = Math.floor(resteSecondes / 60);
        const sec = resteSecondes % 60;
        await client.query('ROLLBACK');
        return res.status(429).json({ message: `Ce parapheur a déjà été scanné. Réessayez dans ${min}m ${sec}s.` });
      }
    }

    const lieuId = await obtenirOuCreerLieu(client, latitude, longitude, lieu);

    const result = await client.query(
      `INSERT INTO scans (parapheur_id, scanner_id, lieu_id, latitude, longitude, precision_gps, scanned_at, sync_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'synchronise') RETURNING *`,
      [parapheur.rows[0].id, req.utilisateur.id, lieuId, latitude || null, longitude || null, precision_gps || null, scanned_at ? new Date(scanned_at) : new Date()]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur enregistrement scan :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  } finally {
    client.release();
  }
}

async function synchroniserScans(req, res) {
  const { scans } = req.body;
  if (!Array.isArray(scans) || scans.length === 0) {
    return res.status(400).json({ message: 'Aucun scan à synchroniser.' });
  }

  const resultats = [];
  for (const scan of scans) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const numero = scan.parapheur_numero?.toUpperCase().trim();
      await client.query(
        'INSERT INTO parapheurs (numero, titre) VALUES ($1, $1) ON CONFLICT (numero) DO NOTHING',
        [numero]
      );
      const parapheur = await client.query('SELECT id FROM parapheurs WHERE numero = $1', [numero]);
      if (!parapheur.rows[0]) {
        await client.query('ROLLBACK');
        resultats.push({ numero: scan.parapheur_numero, succes: false, message: 'Erreur serveur.' });
        continue;
      }

      const lieuId = await obtenirOuCreerLieu(client, scan.latitude, scan.longitude, scan.lieu);

      await client.query(
        `INSERT INTO scans (parapheur_id, scanner_id, lieu_id, latitude, longitude, precision_gps, scanned_at, sync_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'synchronise')`,
        [parapheur.rows[0].id, req.utilisateur.id, lieuId, scan.latitude || null, scan.longitude || null, scan.precision_gps || null, scan.scanned_at ? new Date(scan.scanned_at) : new Date()]
      );

      await client.query('COMMIT');
      resultats.push({ numero: scan.parapheur_numero, succes: true });
    } catch {
      await client.query('ROLLBACK');
      resultats.push({ numero: scan.parapheur_numero, succes: false, message: 'Erreur insertion.' });
    } finally {
      client.release();
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

  if (parapheur_id) { params.push(parapheur_id); conditions.push(`sc.parapheur_id = $${params.length}`); }
  if (scanner_id)   { params.push(scanner_id);   conditions.push(`sc.scanner_id = $${params.length}`); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  params.push(limite, offset);

  try {
    const result = await pool.query(`
      SELECT sc.*, p.numero AS parapheur_numero, p.titre AS parapheur_titre,
             s.nom AS operateur_nom, l.nom_lieu
      FROM scans sc
      JOIN parapheurs p ON sc.parapheur_id = p.id
      LEFT JOIN scanners s ON sc.scanner_id = s.id
      LEFT JOIN lieux l ON sc.lieu_id = l.id
      ${where}
      ORDER BY sc.scanned_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const total = await pool.query(
      `SELECT COUNT(*) FROM scans sc ${where}`,
      params.slice(0, params.length - 2)
    );

    res.json({ scans: result.rows, total: parseInt(total.rows[0].count), page: parseInt(page), limite: parseInt(limite) });
  } catch (err) {
    console.error('Erreur listing scans :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

module.exports = { enregistrerScan, synchroniserScans, listerScans };