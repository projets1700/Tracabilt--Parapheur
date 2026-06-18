require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Insertion des données de test...');
    await client.query('BEGIN');

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

    await client.query('COMMIT');
    console.log('Données de test insérées avec succès.');
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