const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function listerUtilisateurs(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, nom, prenom, email, role, actif, cree_le FROM utilisateurs ORDER BY cree_le DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function creerUtilisateur(req, res) {
  const { nom, prenom, email, mot_de_passe, role } = req.body;
  if (!nom || !prenom || !email || !mot_de_passe || !role) {
    return res.status(400).json({ message: 'Tous les champs sont obligatoires.' });
  }
  if (!['administrateur', 'operateur'].includes(role)) {
    return res.status(400).json({ message: 'Rôle invalide.' });
  }
  try {
    const hash = await bcrypt.hash(mot_de_passe, 10);
    const result = await pool.query(
      'INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, nom, prenom, email, role, cree_le',
      [nom, prenom, email.toLowerCase().trim(), hash, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
    }
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function mettreAJourUtilisateur(req, res) {
  const { id } = req.params;
  const { nom, prenom, role, actif, mot_de_passe } = req.body;
  try {
    let hash = undefined;
    if (mot_de_passe) {
      hash = await bcrypt.hash(mot_de_passe, 10);
    }
    const result = await pool.query(
      `UPDATE utilisateurs SET
        nom = COALESCE($1, nom),
        prenom = COALESCE($2, prenom),
        role = COALESCE($3, role),
        actif = COALESCE($4, actif),
        mot_de_passe = COALESCE($5, mot_de_passe),
        mis_a_jour_le = NOW()
       WHERE id = $6 RETURNING id, nom, prenom, email, role, actif`,
      [nom, prenom, role, actif, hash, id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function supprimerUtilisateur(req, res) {
  const { id } = req.params;
  if (id === req.utilisateur.id) {
    return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte.' });
  }
  try {
    const result = await pool.query(
      'UPDATE utilisateurs SET actif = FALSE, mis_a_jour_le = NOW() WHERE id = $1 RETURNING id',
      [id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }
    res.json({ message: 'Utilisateur désactivé.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function statistiques(req, res) {
  try {
    const [parapheursActifs, scansAujourdhui, operateursActifs, totalEvenements] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM parapheurs WHERE statut NOT IN ('archive')"),
      pool.query("SELECT COUNT(*) FROM evenements WHERE cree_le::date = CURRENT_DATE"),
      pool.query("SELECT COUNT(DISTINCT utilisateur_id) FROM evenements WHERE cree_le::date = CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM evenements"),
    ]);
    res.json({
      parapheurs_actifs: parseInt(parapheursActifs.rows[0].count),
      scans_aujourdhui: parseInt(scansAujourdhui.rows[0].count),
      operateurs_actifs: parseInt(operateursActifs.rows[0].count),
      total_evenements: parseInt(totalEvenements.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

module.exports = { listerUtilisateurs, creerUtilisateur, mettreAJourUtilisateur, supprimerUtilisateur, statistiques };
