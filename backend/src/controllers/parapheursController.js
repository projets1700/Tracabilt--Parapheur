const pool = require('../config/db');

async function listerParapheurs(req, res) {
  try {
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
      conditions.push(`(p.reference ILIKE $${params.length} OR p.description ILIKE $${params.length})`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(limite, offset);

    const result = await pool.query(`
      SELECT p.*,
        (SELECT cree_le FROM evenements WHERE parapheur_id = p.id ORDER BY cree_le DESC LIMIT 1) AS dernier_scan,
        (SELECT localisation_nom FROM evenements WHERE parapheur_id = p.id ORDER BY cree_le DESC LIMIT 1) AS derniere_position,
        (SELECT u.prenom || ' ' || u.nom FROM evenements e JOIN utilisateurs u ON e.utilisateur_id = u.id WHERE e.parapheur_id = p.id ORDER BY e.cree_le DESC LIMIT 1) AS dernier_operateur
      FROM parapheurs p ${where}
      ORDER BY p.mis_a_jour_le DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const total = await pool.query(
      `SELECT COUNT(*) FROM parapheurs p ${where}`,
      params.slice(0, params.length - 2)
    );

    res.json({ parapheurs: result.rows, total: parseInt(total.rows[0].count), page: parseInt(page), limite: parseInt(limite) });
  } catch (err) {
    console.error('Erreur listing parapheurs :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function obtenirParapheur(req, res) {
  const { reference } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM parapheurs WHERE reference = $1',
      [reference.toUpperCase()]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Parapheur introuvable.' });
    }
    const parapheur = result.rows[0];

    const evenements = await pool.query(`
      SELECT e.*, u.prenom || ' ' || u.nom AS operateur_nom
      FROM evenements e
      LEFT JOIN utilisateurs u ON e.utilisateur_id = u.id
      WHERE e.parapheur_id = $1
      ORDER BY e.cree_le DESC
      LIMIT 50
    `, [parapheur.id]);

    res.json({ ...parapheur, evenements: evenements.rows });
  } catch (err) {
    console.error('Erreur obtention parapheur :', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function creerParapheur(req, res) {
  const { reference, description } = req.body;
  if (!reference) {
    return res.status(400).json({ message: 'La référence est obligatoire.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO parapheurs (reference, description) VALUES ($1, $2) RETURNING *',
      [reference.toUpperCase().trim(), description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Cette référence existe déjà.' });
    }
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function mettreAJourParapheur(req, res) {
  const { id } = req.params;
  const { description, statut } = req.body;
  try {
    const result = await pool.query(
      `UPDATE parapheurs SET description = COALESCE($1, description), statut = COALESCE($2, statut), mis_a_jour_le = NOW()
       WHERE id = $3 RETURNING *`,
      [description, statut, id]
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
    const result = await pool.query('DELETE FROM parapheurs WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Parapheur introuvable.' });
    }
    res.json({ message: 'Parapheur supprimé.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

module.exports = { listerParapheurs, obtenirParapheur, creerParapheur, mettreAJourParapheur, supprimerParapheur };
