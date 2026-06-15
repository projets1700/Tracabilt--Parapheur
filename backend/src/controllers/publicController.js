const pool = require('../config/db');

async function rechercherParapheur(req, res) {
  const { numero } = req.params;
  try {
    const result = await pool.query(
      'SELECT id, reference, description, statut FROM parapheurs WHERE reference = $1',
      [numero.toUpperCase().trim()]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Parapheur introuvable.' });
    }
    const parapheur = result.rows[0];

    const dernierScan = await pool.query(`
      SELECT
        e.cree_le,
        e.localisation_nom,
        e.latitude,
        e.longitude,
        u.prenom || ' ' || u.nom AS scanner_utilise
      FROM evenements e
      LEFT JOIN utilisateurs u ON e.utilisateur_id = u.id
      WHERE e.parapheur_id = $1
      ORDER BY e.cree_le DESC
      LIMIT 1
    `, [parapheur.id]);

    const scan = dernierScan.rows[0];

    res.json({
      numero:              parapheur.reference,
      description:         parapheur.description,
      statut:              parapheur.statut,
      dernier_emplacement: scan?.localisation_nom || null,
      date_dernier_scan:   scan ? scan.cree_le.toISOString().split('T')[0] : null,
      heure_dernier_scan:  scan ? scan.cree_le.toISOString().split('T')[1].split('.')[0] : null,
      scanner_utilise:     scan?.scanner_utilise || null,
      latitude:            scan?.latitude || null,
      longitude:           scan?.longitude || null,
    });
  } catch (err) {
    console.error('Erreur recherche publique parapheur :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function historiqueParapheur(req, res) {
  const { numero } = req.params;
  const { page = 1, limite = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limite);

  try {
    const result = await pool.query(
      'SELECT id, reference, statut FROM parapheurs WHERE reference = $1',
      [numero.toUpperCase().trim()]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Parapheur introuvable.' });
    }
    const parapheur = result.rows[0];

    const scans = await pool.query(`
      SELECT
        e.id,
        e.cree_le,
        e.localisation_nom,
        e.latitude,
        e.longitude,
        e.precision_gps,
        u.prenom || ' ' || u.nom AS scanner_utilise
      FROM evenements e
      LEFT JOIN utilisateurs u ON e.utilisateur_id = u.id
      WHERE e.parapheur_id = $1
      ORDER BY e.cree_le DESC
      LIMIT $2 OFFSET $3
    `, [parapheur.id, parseInt(limite), offset]);

    const total = await pool.query(
      'SELECT COUNT(*) FROM evenements WHERE parapheur_id = $1',
      [parapheur.id]
    );

    res.json({
      numero:    parapheur.reference,
      statut:    parapheur.statut,
      total:     parseInt(total.rows[0].count),
      page:      parseInt(page),
      limite:    parseInt(limite),
      historique: scans.rows.map(s => ({
        id:          s.id,
        date:        s.cree_le.toISOString().split('T')[0],
        heure:       s.cree_le.toISOString().split('T')[1].split('.')[0],
        emplacement: s.localisation_nom || null,
        scanner:     s.scanner_utilise || null,
        latitude:    s.latitude || null,
        longitude:   s.longitude || null,
        precision_gps: s.precision_gps || null,
      })),
    });
  } catch (err) {
    console.error('Erreur historique public parapheur :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

module.exports = { rechercherParapheur, historiqueParapheur };
