require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Insertion des données de test...');

    await client.query('BEGIN');

    // Utilisateurs
    const hashAdmin = await bcrypt.hash('admin123', 10);
    const hashOp = await bcrypt.hash('operateur123', 10);

    const admin = await client.query(`
      INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role)
      VALUES ('Dupont', 'Marie', 'admin@organisation.fr', $1, 'administrateur')
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `, [hashAdmin]);

    const op = await client.query(`
      INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role)
      VALUES ('Martin', 'Jean', 'j.martin@organisation.fr', $1, 'operateur')
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `, [hashOp]);

    // Parapheurs
    const refs = [
      ['PAR-2025-00001', 'Dossier budget 2025 — Direction financière'],
      ['PAR-2025-00002', 'Contrat prestataire nettoyage'],
      ['PAR-2025-00003', 'Délibération conseil municipal n°12'],
      ['PAR-2025-00142', 'Appel d\'offres travaux voirie'],
    ];

    const ids = [];
    for (const [ref, desc] of refs) {
      const r = await client.query(`
        INSERT INTO parapheurs (reference, description)
        VALUES ($1, $2)
        ON CONFLICT (reference) DO NOTHING
        RETURNING id
      `, [ref, desc]);
      if (r.rows[0]) ids.push(r.rows[0].id);
    }

    // Événements de scan
    if (ids.length > 0 && op.rows[0]) {
      const operateurId = op.rows[0].id;
      const scans = [
        [ids[0], operateurId, 48.8566, 2.3522, 'Mairie — Hall d\'accueil'],
        [ids[0], operateurId, 48.8580, 2.3490, 'Service des finances'],
        [ids[1], operateurId, 48.8600, 2.3500, 'Direction générale'],
        [ids[3], operateurId, 48.8550, 2.3600, 'Service technique'],
      ];
      for (const [parapheurId, utilisateurId, lat, lng, nom] of scans) {
        await client.query(`
          INSERT INTO evenements (parapheur_id, utilisateur_id, type, latitude, longitude, precision_gps, localisation_nom)
          VALUES ($1, $2, 'scan', $3, $4, 5.0, $5)
        `, [parapheurId, utilisateurId, lat, lng, nom]);
      }
    }

    await client.query('COMMIT');
    console.log('Données de test insérées avec succès.');
    console.log('  Admin    : admin@organisation.fr / admin123');
    console.log('  Opérateur: j.martin@organisation.fr / operateur123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur lors du seed :', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();