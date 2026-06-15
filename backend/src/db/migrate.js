require('dotenv').config();
const pool = require('../config/db');

const schema = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS utilisateurs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           VARCHAR(100) NOT NULL,
  prenom        VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  mot_de_passe  VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('administrateur', 'operateur')),
  actif         BOOLEAN DEFAULT TRUE,
  cree_le       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  mis_a_jour_le TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parapheurs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference     VARCHAR(50) UNIQUE NOT NULL,
  description   TEXT,
  statut        VARCHAR(30) NOT NULL DEFAULT 'en_transit'
                CHECK (statut IN ('en_transit', 'livre', 'en_attente', 'archive')),
  cree_le       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  mis_a_jour_le TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evenements (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parapheur_id         UUID NOT NULL REFERENCES parapheurs(id) ON DELETE CASCADE,
  utilisateur_id       UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
  type                 VARCHAR(20) NOT NULL DEFAULT 'scan'
                       CHECK (type IN ('scan', 'sync', 'alerte')),
  latitude             DECIMAL(10, 7),
  longitude            DECIMAL(10, 7),
  precision_gps        DECIMAL(8, 2),
  localisation_nom     VARCHAR(255),
  identifiant_appareil VARCHAR(100),
  synchronise          BOOLEAN DEFAULT TRUE,
  cree_le              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evenements_parapheur   ON evenements(parapheur_id);
CREATE INDEX IF NOT EXISTS idx_evenements_date        ON evenements(cree_le DESC);
CREATE INDEX IF NOT EXISTS idx_evenements_utilisateur ON evenements(utilisateur_id);
CREATE INDEX IF NOT EXISTS idx_parapheurs_reference   ON parapheurs(reference);
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