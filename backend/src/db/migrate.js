require('dotenv').config();
const pool = require('../config/db');

const schema = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scanners (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           VARCHAR(100) NOT NULL,
  identifiant   VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  device_id     VARCHAR(255),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parapheurs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero     VARCHAR(50) UNIQUE NOT NULL,
  titre      VARCHAR(255) NOT NULL,
  statut     VARCHAR(30) NOT NULL DEFAULT 'en_circulation'
             CHECK (statut IN ('en_circulation', 'archive')),
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parapheur_id  UUID NOT NULL REFERENCES parapheurs(id) ON DELETE CASCADE,
  scanner_id    UUID REFERENCES scanners(id) ON DELETE SET NULL,
  latitude      DECIMAL(10, 7),
  longitude     DECIMAL(10, 7),
  precision_gps DECIMAL(8, 2),
  scanned_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_status   VARCHAR(20) NOT NULL DEFAULT 'synchronise'
                CHECK (sync_status IN ('synchronise', 'en_attente', 'erreur')),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scans_parapheur ON scans(parapheur_id);
CREATE INDEX IF NOT EXISTS idx_scans_scanner   ON scans(scanner_id);
CREATE INDEX IF NOT EXISTS idx_scans_date      ON scans(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_parapheurs_numero ON parapheurs(numero);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Migration en cours...');
    await client.query(schema);
    console.log('Migration terminée avec succès.');
  } catch (err) {
    console.error('Erreur lors de la migration :', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();