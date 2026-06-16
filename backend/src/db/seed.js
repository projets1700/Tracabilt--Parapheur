require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Insertion des données de test...');
    await client.query('BEGIN');

    // Admin
    const hashAdmin = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO admins (nom, email, password_hash)
      VALUES ('Dupont Marie', 'admin@organisation.fr', $1)
      ON CONFLICT (email) DO NOTHING
    `, [hashAdmin]);

    // Scanners
    const hashScanner1 = await bcrypt.hash('scanner123', 10);
    const hashScanner2 = await bcrypt.hash('scanner456', 10);

    const sc1 = await client.query(`
      INSERT INTO scanners (nom, identifiant, password_hash, device_id)
      VALUES ('Jean Martin', 'j.martin', $1, 'ANDROID-001')
      ON CONFLICT (identifiant) DO NOTHING
      RETURNING id
    `, [hashScanner1]);

    const sc2 = await client.query(`
      INSERT INTO scanners (nom, identifiant, password_hash, device_id)
      VALUES ('Sophie Bernard', 's.bernard', $1, 'ANDROID-002')
      ON CONFLICT (identifiant) DO NOTHING
      RETURNING id
    `, [hashScanner2]);

    // Parapheurs
    const parapheurs = [
      ['PAR-2025-00001', 'Dossier budget 2025 — Direction financière'],
      ['PAR-2025-00002', 'Contrat prestataire nettoyage'],
      ['PAR-2025-00003', 'Délibération conseil municipal n°12'],
      ['PAR-2025-00142', 'Appel d\'offres travaux voirie'],
    ];

    const ids = [];
    for (const [numero, titre] of parapheurs) {
      const r = await client.query(`
        INSERT INTO parapheurs (numero, titre)
        VALUES ($1, $2)
        ON CONFLICT (numero) DO NOTHING
        RETURNING id
      `, [numero, titre]);
      if (r.rows[0]) ids.push(r.rows[0].id);
    }

    // Scans de démonstration
    if (ids.length > 0 && sc1.rows[0]) {
      const scannerId = sc1.rows[0].id;
      const demoScans = [
        [ids[0], scannerId, 48.8566, 2.3522],
        [ids[0], scannerId, 48.8580, 2.3490],
        [ids[1], scannerId, 48.8600, 2.3500],
        [ids[3], scannerId, 48.8550, 2.3600],
      ];
      for (const [parapheurId, sid, lat, lng] of demoScans) {
        await client.query(`
          INSERT INTO scans (parapheur_id, scanner_id, latitude, longitude, precision_gps)
          VALUES ($1, $2, $3, $4, 5.0)
        `, [parapheurId, sid, lat, lng]);
      }
    }

    await client.query('COMMIT');
    console.log('Données de test insérées avec succès.');
    console.log('  Admin   : admin@organisation.fr / admin123');
    console.log('  Scanner1: j.martin / scanner123');
    console.log('  Scanner2: s.bernard / scanner456');
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