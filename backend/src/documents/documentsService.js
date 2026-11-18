/**
 * Module documentaire — côté serveur.
 *
 * Les documents et les QR codes sont traités dans le navigateur : le serveur
 * ne conserve AUCUN document ni QR code. Il assure uniquement :
 *  - l'unicité des noms de QR codes (registre noms_qr) : deux QR codes ne
 *    peuvent jamais porter le même nom ;
 *  - la conversion Word / OpenDocument → PDF, sans rien conserver.
 * Le parapheur correspondant à un QR code est créé au premier scan
 * (application mobile, route /api/scans).
 */
const crypto = require('crypto');
const pool = require('../config/db');
const libreoffice = require('./libreoffice');
const pdfOutils = require('./pdfOutils');
const { validerFichier, nettoyerNom, ErreurValidation } = require('./validationFichier');

const TAILLE_MAX_DEFAUT = 20 * 1024 * 1024;

class ErreurMetier extends Error {
  constructor(message, statut = 400) {
    super(message);
    this.statut = statut;
  }
}

/** Taille maximale des fichiers à convertir (paramètre administrateur, 20 Mo par défaut). */
async function obtenirConfig() {
  const { rows } = await pool.query("SELECT valeur FROM parametres WHERE cle = 'documents.taille_max_octets'");
  return { taille_max_octets: Number(rows[0]?.valeur) || TAILLE_MAX_DEFAUT };
}

/* ======================================================================
 * Noms des QR codes (= numéro du parapheur encodé dans le QR code)
 * ==================================================================== */

const PREFIXE_NUMERO = 'DEP-';
const formaterNumero = n => `${PREFIXE_NUMERO}${String(n).padStart(6, '0')}`;
const MOTIF_NOM = /^[A-Z0-9][A-Z0-9-]{0,49}$/;

/** Normalise et valide un nom (majuscules : l'application mobile lit en majuscules). */
function normaliserNom(brut) {
  const nom = String(brut ?? '').trim().toUpperCase();
  if (!nom) throw new ErreurMetier('Donnez un nom au QR code.', 400);
  if (!MOTIF_NOM.test(nom)) {
    throw new ErreurMetier('Nom de QR code invalide : lettres, chiffres et tirets uniquement (50 caractères maximum).', 400);
  }
  return nom;
}

const nomDejaPris = nom => new ErreurMetier(`Le nom « ${nom} » est déjà utilisé par un autre QR code. Choisissez-en un autre.`, 409);

/** Prochain nom DEP libre (simple suggestion : rien n'est réservé). */
async function suggererNom() {
  for (let essai = 0; essai < 1000; essai++) {
    const { rows: [{ n }] } = await pool.query("SELECT nextval('seq_numero_dep') AS n");
    const numero = formaterNumero(n);
    const { rows } = await pool.query(
      'SELECT 1 FROM noms_qr WHERE numero = $1 UNION SELECT 1 FROM parapheurs WHERE numero = $1 LIMIT 1',
      [numero],
    );
    if (!rows.length) return numero;
  }
  throw new ErreurMetier('Impossible de proposer un nom de QR code libre.', 500);
}

const hacher = cle => crypto.createHash('sha256').update(String(cle)).digest('hex');

/**
 * Réserve un nom de QR code : refusé s'il a déjà été donné à un QR code ou s'il
 * correspond à un parapheur existant (déjà scanné). C'est la SEULE donnée
 * conservée à la création d'un QR code. Renvoie une clé secrète permettant de
 * libérer le nom si le QR code est supprimé avant d'avoir servi.
 */
async function reserverNom(brut) {
  const numero = normaliserNom(brut);
  const parapheur = await pool.query('SELECT 1 FROM parapheurs WHERE numero = $1', [numero]);
  if (parapheur.rows.length) throw nomDejaPris(numero);
  const cle = crypto.randomBytes(24).toString('base64url');
  // Clé primaire : garantie d'unicité, même en cas de demandes simultanées.
  const { rows } = await pool.query(
    'INSERT INTO noms_qr (numero, cle_hash) VALUES ($1, $2) ON CONFLICT (numero) DO NOTHING RETURNING numero',
    [numero, hacher(cle)],
  );
  if (!rows.length) throw nomDejaPris(numero);
  return { numero, cle };
}

/** Libère un nom réservé (QR code supprimé), uniquement avec la clé reçue à la réservation. */
async function libererNom(brut, cle) {
  if (!cle) return false;
  const numero = String(brut ?? '').trim().toUpperCase();
  const { rowCount } = await pool.query(
    'DELETE FROM noms_qr WHERE numero = $1 AND qr_code_id IS NULL AND cle_hash = $2',
    [numero, hacher(cle)],
  );
  return rowCount > 0;
}

/* ======================================================================
 * Conversion Word / OpenDocument → PDF (rien n'est conservé)
 * ==================================================================== */

const LIBELLES_FORMAT = { pdf: 'PDF', docx: 'Word', doc: 'Word 97-2003', odt: 'OpenDocument' };

async function convertirEnPdf(nomFichier, octets) {
  const nom = nettoyerNom(nomFichier);
  const { taille_max_octets: tailleMax } = await obtenirConfig();
  let format;
  let aConvertir;
  try {
    ({ format, aConvertir } = await validerFichier(nom, octets, tailleMax));
  } catch (err) {
    if (err instanceof ErreurValidation) throw new ErreurMetier(err.message, err.statut);
    throw err;
  }
  if (!aConvertir) throw new ErreurMetier('Ce fichier est déjà un PDF.', 400);

  let pdf;
  try {
    pdf = await libreoffice.documentVersPdf(octets, format);
  } catch (err) {
    if (err instanceof libreoffice.ErreurConversion) {
      throw new ErreurMetier(`Conversion du document ${LIBELLES_FORMAT[format]} en PDF impossible : ${err.message}`, 422);
    }
    throw err;
  }
  const pages = await pdfOutils.infosPages(pdf).catch(() => null);
  if (!pages?.length) throw new ErreurMetier('La conversion en PDF a produit un document vide ou illisible.', 422);
  return { pdf, nom: `${nom.replace(/\.[^.]+$/, '')}.pdf` };
}

module.exports = {
  ErreurMetier,
  obtenirConfig,
  normaliserNom,
  suggererNom,
  reserverNom,
  libererNom,
  convertirEnPdf,
};
