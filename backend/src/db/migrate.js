require('dotenv').config();
const pool = require('../config/db');

const schema = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

CREATE TABLE IF NOT EXISTS lieux (
  id          SERIAL PRIMARY KEY,
  latitude    DECIMAL(10, 7),
  longitude   DECIMAL(10, 7),
  nom_lieu    VARCHAR(255) NOT NULL,
  adresse     TEXT,
  ville       VARCHAR(100),
  code_postal VARCHAR(20),
  pays        VARCHAR(100),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parapheur_id  UUID NOT NULL REFERENCES parapheurs(id) ON DELETE CASCADE,
  scanner_id    UUID REFERENCES scanners(id) ON DELETE SET NULL,
  lieu_id       INTEGER REFERENCES lieux(id) ON DELETE SET NULL,
  latitude      DECIMAL(10, 7),
  longitude     DECIMAL(10, 7),
  precision_gps DECIMAL(8, 2),
  scanned_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_status   VARCHAR(20) NOT NULL DEFAULT 'synchronise'
                CHECK (sync_status IN ('synchronise', 'en_attente', 'erreur')),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migrations rétrocompatibles si les tables existaient déjà
ALTER TABLE scans ADD COLUMN IF NOT EXISTS lieu_id INTEGER REFERENCES lieux(id) ON DELETE SET NULL;
ALTER TABLE scans DROP COLUMN IF EXISTS lieu;
ALTER TABLE lieux ALTER COLUMN latitude  DROP NOT NULL;
ALTER TABLE lieux ALTER COLUMN longitude DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scans_parapheur  ON scans(parapheur_id);
CREATE INDEX IF NOT EXISTS idx_scans_scanner    ON scans(scanner_id);
CREATE INDEX IF NOT EXISTS idx_scans_date       ON scans(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_parapheurs_numero ON parapheurs(numero);

CREATE TABLE IF NOT EXISTS admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           VARCHAR(100) NOT NULL,
  identifiant   VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS superviseurs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom                VARCHAR(100) NOT NULL,
  identifiant        VARCHAR(100) UNIQUE NOT NULL,
  password_hash      VARCHAR(255) NOT NULL,
  premiere_connexion BOOLEAN DEFAULT TRUE,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE superviseurs ADD COLUMN IF NOT EXISTS premiere_connexion BOOLEAN DEFAULT TRUE;

-- ============================================================
-- Module de gestion documentaire et QR codes (CDC §6)
-- ============================================================

CREATE TABLE IF NOT EXISTS parametres (
  cle        VARCHAR(100) PRIMARY KEY,
  valeur     JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parapheur_id     UUID REFERENCES parapheurs(id) ON DELETE SET NULL,
  name             VARCHAR(255) NOT NULL,
  original_path    TEXT NOT NULL,
  preview_path     TEXT,
  generated_path   TEXT,
  generated_name   VARCHAR(255),
  generated_format VARCHAR(10) CHECK (generated_format IN ('pdf', 'docx')),
  original_format  VARCHAR(10) NOT NULL CHECK (original_format IN ('pdf', 'docx')),
  size             BIGINT,
  pages            JSONB NOT NULL DEFAULT '[]',
  ancrages         JSONB,
  status           VARCHAR(20) NOT NULL DEFAULT 'importe'
                   CHECK (status IN ('importe', 'en_edition', 'genere', 'erreur')),
  created_by       UUID,
  created_by_role  VARCHAR(20),
  created_by_name  VARCHAR(100),
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  generated_at     TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS qr_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  reference   VARCHAR(40) UNIQUE NOT NULL,
  content     TEXT NOT NULL,
  created_by  UUID,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qr_code_positions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id    UUID NOT NULL UNIQUE REFERENCES qr_codes(id) ON DELETE CASCADE,
  page_number   INTEGER NOT NULL CHECK (page_number >= 1),
  position_x    DECIMAL(10, 2) NOT NULL,
  position_y    DECIMAL(10, 2) NOT NULL,
  width         DECIMAL(10, 2) NOT NULL,
  height        DECIMAL(10, 2) NOT NULL,
  unite         VARCHAR(5) NOT NULL DEFAULT 'pt',
  page_largeur  DECIMAL(10, 2),
  page_hauteur  DECIMAL(10, 2),
  page_rotation INTEGER DEFAULT 0,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     UUID,
  user_role   VARCHAR(20),
  user_name   VARCHAR(100),
  action      VARCHAR(40) NOT NULL,
  details     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Format du fichier importé (les documents Word / ODT sont convertis en PDF à l'import ;
-- original_format désigne alors le format de travail « pdf »).
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_format VARCHAR(10);
UPDATE documents SET source_format = original_format WHERE source_format IS NULL;

-- Chaque QR code porte son propre numéro de parapheur unique « DEP-000001 »,
-- attribué par cette séquence (jamais réutilisé).
CREATE SEQUENCE IF NOT EXISTS seq_numero_dep START 1;
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS parapheur_id UUID REFERENCES parapheurs(id) ON DELETE SET NULL;
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS numero VARCHAR(50);
CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_codes_numero ON qr_codes(numero) WHERE numero IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qr_codes_parapheur ON qr_codes(parapheur_id);

-- Registre des noms de QR codes : un nom ne peut appartenir qu'à un seul QR code.
--   qr_code_id renseigné : QR code enregistré sur le serveur (nom libéré à sa suppression) ;
--   qr_code_id NULL      : nom réservé par un visiteur (cle_hash permet de le libérer).
CREATE TABLE IF NOT EXISTS noms_qr (
  numero     VARCHAR(50) PRIMARY KEY,
  qr_code_id UUID UNIQUE REFERENCES qr_codes(id) ON DELETE CASCADE,
  cle_hash   VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Parapheurs créés automatiquement pour un QR code : seuls ceux-là peuvent être
-- nettoyés (jamais un parapheur créé par ailleurs).
ALTER TABLE parapheurs ADD COLUMN IF NOT EXISTS cree_par_qr BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE parapheurs SET cree_par_qr = TRUE
  WHERE numero LIKE 'DEP-%' AND id IN (SELECT parapheur_id FROM qr_codes WHERE parapheur_id IS NOT NULL);

INSERT INTO noms_qr (numero, qr_code_id)
  SELECT numero, id FROM qr_codes WHERE numero IS NOT NULL
  ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_documents_parapheur ON documents(parapheur_id);
CREATE INDEX IF NOT EXISTS idx_documents_maj       ON documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_codes_document   ON qr_codes(document_id);
CREATE INDEX IF NOT EXISTS idx_historique_document ON document_history(document_id, created_at DESC);
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