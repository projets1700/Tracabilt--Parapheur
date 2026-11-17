/**
 * Service métier du module documentaire (cahier des charges §2, §3, §6).
 */
const crypto = require('crypto');
const pool = require('../config/db');
const stockage = require('./stockage');
const ooxml = require('./ooxml');
const libreoffice = require('./libreoffice');
const pdfOutils = require('./pdfOutils');
const { genererJeton, pngQr } = require('./qr');
const { validerFichier, nettoyerNom, ErreurValidation } = require('./validationFichier');

const TAILLE_MAX_DEFAUT = 20 * 1024 * 1024;
const TAILLE_MAX_ABSOLUE = 500 * 1024 * 1024;
const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  odt: 'application/vnd.oasis.opendocument.text',
};

class ErreurMetier extends Error {
  constructor(message, statut = 400) {
    super(message);
    this.statut = statut;
  }
}

const introuvable = () => new ErreurMetier('Document introuvable.', 404);

/* ======================================================================
 * Paramètres (configurables par l'administrateur)
 * ==================================================================== */

async function obtenirConfig() {
  const { rows } = await pool.query("SELECT cle, valeur FROM parametres WHERE cle LIKE 'documents.%'");
  const p = Object.fromEntries(rows.map(r => [r.cle.slice('documents.'.length), r.valeur]));
  return {
    taille_max_octets: Number(p.taille_max_octets) || TAILLE_MAX_DEFAUT,
    // « numero » : le QR contient le numéro du parapheur (lu tel quel par l'application mobile).
    // « jeton »  : le QR contient un jeton non prédictible, résolu par le serveur (§3.3).
    qr_contenu: p.qr_contenu === 'jeton' ? 'jeton' : 'numero',
    formats: ['pdf', 'docx'],
  };
}

async function modifierConfig({ taille_max_octets, qr_contenu }) {
  const maj = [];
  if (taille_max_octets !== undefined) {
    const t = Number(taille_max_octets);
    if (!Number.isFinite(t) || t < 100 * 1024 || t > TAILLE_MAX_ABSOLUE) {
      throw new ErreurMetier('La taille maximale doit être comprise entre 0,1 et 500 Mo.');
    }
    maj.push(['documents.taille_max_octets', Math.round(t)]);
  }
  if (qr_contenu !== undefined) {
    if (!['numero', 'jeton'].includes(qr_contenu)) throw new ErreurMetier('Mode de contenu de QR code invalide.');
    maj.push(['documents.qr_contenu', qr_contenu]);
  }
  for (const [cle, valeur] of maj) {
    await pool.query(
      `INSERT INTO parametres (cle, valeur, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, updated_at = NOW()`,
      [cle, JSON.stringify(valeur)],
    );
  }
  return obtenirConfig();
}

/* ======================================================================
 * Historisation (§3.8)
 * ==================================================================== */

async function historiser(db, documentId, utilisateur, action, description, details = {}) {
  await db.query(
    `INSERT INTO document_history (document_id, user_id, user_role, user_name, action, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [documentId, utilisateur?.id || null, utilisateur?.role || null, utilisateur?.nom || utilisateur?.identifiant || null,
      action, JSON.stringify({ description, ...details })],
  );
}

/* ======================================================================
 * Sérialisation (aucun chemin de stockage n'est exposé)
 * ==================================================================== */

function serialiserDocument(r) {
  return {
    id: r.id,
    name: r.name,
    original_format: r.original_format,
    source_format: r.source_format || r.original_format,
    status: r.status,
    parapheur_id: r.parapheur_id,
    parapheur_numero: r.parapheur_numero ?? null,
    parapheur_titre: r.parapheur_titre ?? null,
    generated_name: r.generated_name,
    generated_format: r.generated_format,
    generated_at: r.generated_at,
    size: r.size !== null && r.size !== undefined ? Number(r.size) : null,
    page_count: Array.isArray(r.pages) ? r.pages.length : 0,
    qr_count: r.qr_count !== undefined ? Number(r.qr_count) : undefined,
    qr_numeros: r.qr_numeros || '',
    created_by: r.created_by,
    created_by_name: r.created_by_name,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function serialiserQr(r) {
  return {
    id: r.id,
    document_id: r.document_id,
    reference: r.reference,
    content: r.content,
    numero: r.numero,
    parapheur_id: r.parapheur_id,
    created_at: r.created_at,
    position: {
      page_number: r.page_number,
      position_x: Number(r.position_x),
      position_y: Number(r.position_y),
      width: Number(r.width),
      height: Number(r.height),
      unite: r.unite,
      origine: 'haut-gauche',
    },
  };
}

const SELECT_DOCUMENT = `
  SELECT d.*, p.numero AS parapheur_numero, p.titre AS parapheur_titre,
         (SELECT COUNT(*) FROM qr_codes q WHERE q.document_id = d.id) AS qr_count,
         (SELECT string_agg(q.numero, ', ' ORDER BY q.numero) FROM qr_codes q WHERE q.document_id = d.id) AS qr_numeros
  FROM documents d
  LEFT JOIN parapheurs p ON p.id = d.parapheur_id`;

async function ligneDocument(id, db = pool) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw introuvable();
  const { rows } = await db.query(`${SELECT_DOCUMENT} WHERE d.id = $1`, [id]);
  if (!rows[0]) throw introuvable();
  return rows[0];
}

async function lignesQr(documentId, db = pool) {
  const { rows } = await db.query(
    `SELECT q.*, pos.page_number, pos.position_x, pos.position_y, pos.width, pos.height, pos.unite
     FROM qr_codes q JOIN qr_code_positions pos ON pos.qr_code_id = q.id
     WHERE q.document_id = $1 ORDER BY pos.page_number, q.created_at`,
    [documentId],
  );
  return rows;
}

/* ======================================================================
 * Noms des QR codes (= numéro du parapheur encodé dans le QR code).
 * Choisis par l'utilisateur ; un nom ne peut appartenir qu'à un seul QR code
 * (registre noms_qr, clé primaire = garantie même en cas d'appels simultanés).
 * Une suggestion DEP-000001, DEP-000002… est proposée par défaut.
 * ==================================================================== */

const PREFIXE_NUMERO = 'DEP-';
const formaterNumero = n => `${PREFIXE_NUMERO}${String(n).padStart(6, '0')}`;
const MOTIF_NOM = /^[A-Z0-9][A-Z0-9-]{0,49}$/;

/** Normalise et valide un nom de QR code (majuscules : l'application mobile lit en majuscules). */
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
async function suggererNom(db = pool) {
  for (let essai = 0; essai < 1000; essai++) {
    const { rows: [{ n }] } = await db.query("SELECT nextval('seq_numero_dep') AS n");
    const numero = formaterNumero(n);
    // Évite un nom déjà pris par un QR code ou par un parapheur créé autrement (saisie, scan).
    const { rows } = await db.query(
      'SELECT 1 FROM noms_qr WHERE numero = $1 UNION SELECT 1 FROM parapheurs WHERE numero = $1 LIMIT 1',
      [numero],
    );
    if (!rows.length) return numero;
  }
  throw new ErreurMetier("Impossible de proposer un nom de QR code libre.", 500);
}

const hacher = cle => crypto.createHash('sha256').update(String(cle)).digest('hex');

/**
 * Visiteur : réserve un nom (le parapheur sera créé au premier scan mobile).
 * Renvoie une clé secrète permettant au seul visiteur de libérer ce nom.
 */
async function reserverNomVisiteur(brut) {
  const numero = normaliserNom(brut);
  const cle = crypto.randomBytes(24).toString('base64url');
  const { rows } = await pool.query(
    'INSERT INTO noms_qr (numero, cle_hash) VALUES ($1, $2) ON CONFLICT (numero) DO NOTHING RETURNING numero',
    [numero, hacher(cle)],
  );
  if (!rows.length) throw nomDejaPris(numero);
  return { numero, cle };
}

/** Visiteur : libère un nom qu'il a réservé (QR code supprimé ou renommé). */
async function libererNomVisiteur(brut, cle) {
  const numero = String(brut ?? '').trim().toUpperCase();
  if (!cle) return false;
  const { rowCount } = await pool.query(
    'DELETE FROM noms_qr WHERE numero = $1 AND qr_code_id IS NULL AND cle_hash = $2',
    [numero, hacher(cle)],
  );
  return rowCount > 0;
}

/** Parapheur du QR code : existant (même numéro) ou créé. */
async function parapheurPourNom(db, numero, titre) {
  const existant = await db.query('SELECT id FROM parapheurs WHERE numero = $1', [numero]);
  if (existant.rows[0]) return existant.rows[0].id;
  const { rows: [p] } = await db.query(
    'INSERT INTO parapheurs (numero, titre, cree_par_qr) VALUES ($1, $2, TRUE) RETURNING id',
    [numero, String(titre).slice(0, 255)],
  );
  return p.id;
}

/** Supprime les parapheurs DEP devenus inutiles (jamais scannés, plus utilisés). */
async function nettoyerParapheursQr(db, parapheurIds) {
  const ids = [...new Set(parapheurIds.filter(Boolean))];
  if (!ids.length) return;
  await db.query(
    `DELETE FROM parapheurs p
     WHERE p.id = ANY($1::uuid[])
       AND p.cree_par_qr
       AND NOT EXISTS (SELECT 1 FROM scans s WHERE s.parapheur_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM qr_codes q WHERE q.parapheur_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.parapheur_id = p.id)`,
    [ids],
  );
}

async function parapheurParId(id, db = pool) {
  if (!id) return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErreurMetier('Parapheur invalide.');
  const { rows } = await db.query('SELECT id, numero, titre FROM parapheurs WHERE id = $1', [id]);
  if (!rows[0]) throw new ErreurMetier('Le parapheur sélectionné est introuvable.', 404);
  return rows[0];
}

/* ======================================================================
 * Importation (§3.1) et préparation de l'aperçu (§3.2)
 * ==================================================================== */

const LIBELLES_FORMAT = { pdf: 'PDF', docx: 'Word', doc: 'Word 97-2003', odt: 'OpenDocument' };

async function validerOuErreurMetier(nom, octets) {
  const config = await obtenirConfig();
  try {
    return await validerFichier(nom, octets, config.taille_max_octets);
  } catch (err) {
    if (err instanceof ErreurValidation) throw new ErreurMetier(err.message, err.statut);
    throw err;
  }
}

/** Conversion d'un document texte (Word, ODT) en PDF, contrôlée. */
async function convertirEnPdfVerifie(octets, format) {
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
  return { pdf, pages };
}

/**
 * Conversion seule, sans stockage : utilisée par les visiteurs non connectés,
 * dont les documents sont ensuite traités dans le navigateur.
 */
async function convertirEnPdf(nomFichier, octets) {
  const nom = nettoyerNom(nomFichier);
  const { format, aConvertir } = await validerOuErreurMetier(nom, octets);
  if (!aConvertir) throw new ErreurMetier('Ce fichier est déjà un PDF.', 400);
  const { pdf } = await convertirEnPdfVerifie(octets, format);
  return { pdf, nom: `${nom.replace(/\.[^.]+$/, '')}.pdf` };
}

async function importer({ nomFichier, octets, parapheurId, utilisateur }) {
  const nom = nettoyerNom(nomFichier);
  const { format, aConvertir } = await validerOuErreurMetier(nom, octets);
  const parapheur = await parapheurParId(parapheurId);

  const id = crypto.randomUUID();
  let pages;
  let cheminPdf = null;

  try {
    // L'original est conservé tel quel ; il n'est jamais réécrit.
    const cheminOriginal = await stockage.ecrireNouveau(stockage.cheminRelatif(id, `original.${format}`), octets);

    if (aConvertir) {
      // Word / ODT : converti en PDF, qui devient le document de travail.
      const conversion = await convertirEnPdfVerifie(octets, format);
      cheminPdf = await stockage.ecrire(stockage.cheminRelatif(id, 'apercu.pdf'), conversion.pdf);
      ({ pages } = conversion);
    } else {
      pages = await pdfOutils.infosPages(octets);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO documents (id, parapheur_id, name, original_path, preview_path, original_format, source_format, size, pages,
                                status, created_by, created_by_role, created_by_name)
         VALUES ($1,$2,$3,$4,$5,'pdf',$6,$7,$8,'importe',$9,$10,$11)`,
        [id, parapheur?.id || null, nom, cheminOriginal, cheminPdf, format, octets.length, JSON.stringify(pages),
          utilisateur?.id || null, utilisateur?.role || null, utilisateur?.nom || utilisateur?.identifiant || null],
      );
      await historiser(client, id, utilisateur, 'import', `Importation du document « ${nom} »`, { format, taille: octets.length, pages: pages.length });
      if (aConvertir) {
        await historiser(client, id, utilisateur, 'conversion', `Conversion du document ${LIBELLES_FORMAT[format]} en PDF`, { format_source: format });
      }
      if (parapheur) {
        await historiser(client, id, utilisateur, 'association_parapheur', `Association au parapheur ${parapheur.numero}`, { parapheur_id: parapheur.id });
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    await stockage.supprimerDocument(id).catch(() => {});
    if (err instanceof ErreurValidation) throw new ErreurMetier(err.message, err.statut);
    throw err;
  }

  return serialiserDocument(await ligneDocument(id));
}

/* ======================================================================
 * Consultation
 * ==================================================================== */

async function lister({ parapheurId } = {}) {
  const params = [];
  let where = '';
  if (parapheurId) {
    if (!/^[0-9a-f-]{36}$/i.test(parapheurId)) return [];
    params.push(parapheurId);
    // Document associé au parapheur, ou contenant un QR code portant son numéro.
    where = 'WHERE d.parapheur_id = $1 OR EXISTS (SELECT 1 FROM qr_codes q WHERE q.document_id = d.id AND q.parapheur_id = $1)';
  }
  const { rows } = await pool.query(`${SELECT_DOCUMENT} ${where} ORDER BY d.updated_at DESC LIMIT 500`, params);
  return rows.map(serialiserDocument);
}

async function obtenir(id) {
  const doc = await ligneDocument(id);
  const qrcodes = (await lignesQr(id)).map(serialiserQr);
  return { document: { ...serialiserDocument(doc), pages: doc.pages }, qrcodes };
}

async function apercu(id) {
  const doc = await ligneDocument(id);
  return stockage.lire(doc.preview_path || doc.original_path);
}

/* ======================================================================
 * Association au parapheur (§3.7)
 * ==================================================================== */

async function modifier(id, { parapheur_id: parapheurId }, utilisateur) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const doc = await ligneDocument(id, client);
    const parapheur = await parapheurParId(parapheurId || null, client);
    if ((doc.parapheur_id || null) !== (parapheur?.id || null)) {
      // Les QR codes gardent leur propre numéro DEP : seule l'association du document change.
      await client.query('UPDATE documents SET parapheur_id = $2, updated_at = NOW() WHERE id = $1', [id, parapheur?.id || null]);
      await historiser(client, id, utilisateur, 'association_parapheur',
        parapheur ? `Association au parapheur ${parapheur.numero}` : 'Dissociation du parapheur',
        { parapheur_id: parapheur?.id || null, ancien_parapheur_id: doc.parapheur_id });
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return obtenir(id);
}

/* ======================================================================
 * QR codes (§3.3, §3.4)
 * ==================================================================== */

function lirePosition(corps) {
  return {
    page_number: Number.parseInt(corps.page_number, 10),
    position_x: Number(corps.position_x),
    position_y: Number(corps.position_y),
    width: Number(corps.width),
    height: Number(corps.height),
  };
}

function controlerPosition(pos, doc) {
  const erreur = pdfOutils.verifierPosition(pos, doc.pages);
  if (erreur) throw new ErreurMetier(erreur, 422);
}

async function marquerEnEdition(client, id) {
  await client.query(
    "UPDATE documents SET status = CASE WHEN status IN ('importe','genere','erreur') THEN 'en_edition' ELSE status END, updated_at = NOW() WHERE id = $1",
    [id],
  );
}

async function creerQr(id, corps, utilisateur) {
  // Nom choisi par l'utilisateur (à défaut : prochain DEP libre).
  const numero = corps.nom !== undefined && corps.nom !== null && corps.nom !== ''
    ? normaliserNom(corps.nom)
    : await suggererNom();
  // Lue AVANT d'ouvrir la transaction : utiliser une autre connexion du pool pendant
  // la transaction provoque un interblocage quand plusieurs QR sont créés en même temps.
  const config = await obtenirConfig();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const doc = await ligneDocument(id, client);
    const pos = lirePosition(corps);
    controlerPosition(pos, doc);

    // Le QR code est rattaché au parapheur de même numéro (créé s'il n'existe pas).
    const parapheurId = await parapheurPourNom(client, numero, doc.name);

    const reference = genererJeton();
    const contenu = config.qr_contenu === 'jeton' ? reference : numero;
    const page = doc.pages[pos.page_number - 1];

    const { rows: [qr] } = await client.query(
      `INSERT INTO qr_codes (document_id, reference, content, numero, parapheur_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, reference, contenu, numero, parapheurId, utilisateur?.id || null],
    );
    // Registre des noms : échoue si le nom est déjà pris (y compris par un visiteur).
    const { rows: pris } = await client.query(
      'INSERT INTO noms_qr (numero, qr_code_id) VALUES ($1, $2) ON CONFLICT (numero) DO NOTHING RETURNING numero',
      [numero, qr.id],
    );
    if (!pris.length) throw nomDejaPris(numero);
    await client.query(
      `INSERT INTO qr_code_positions (qr_code_id, page_number, position_x, position_y, width, height, page_largeur, page_hauteur, page_rotation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [qr.id, pos.page_number, pos.position_x, pos.position_y, pos.width, pos.height, page.largeur, page.hauteur, page.rotation || 0],
    );
    await marquerEnEdition(client, id);
    await historiser(client, id, utilisateur, 'ajout_qr', `Ajout du QR code ${numero} (page ${pos.page_number})`,
      { numero, reference, page: pos.page_number, x: pos.position_x, y: pos.position_y, taille: pos.width });
    await client.query('COMMIT');
    return serialiserQr({ ...qr, ...pos, unite: 'pt' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') throw nomDejaPris(numero); // contrainte d'unicité PostgreSQL
    throw err;
  } finally {
    client.release();
  }
}

async function ligneQr(client, id, qrId) {
  if (!/^[0-9a-f-]{36}$/i.test(qrId)) throw new ErreurMetier('QR code introuvable.', 404);
  const { rows } = await client.query(
    `SELECT q.*, pos.page_number, pos.position_x, pos.position_y, pos.width, pos.height, pos.unite
     FROM qr_codes q JOIN qr_code_positions pos ON pos.qr_code_id = q.id
     WHERE q.id = $1 AND q.document_id = $2`,
    [qrId, id],
  );
  if (!rows[0]) throw new ErreurMetier('QR code introuvable.', 404);
  return rows[0];
}

const CHAMPS_POSITION = ['page_number', 'position_x', 'position_y', 'width', 'height'];

/**
 * Modification d'un QR code : position/dimensions et/ou nom (renommage),
 * le nouveau nom devant rester unique.
 */
async function modifierQr(id, qrId, corps, utilisateur) {
  const nouveauNom = corps.nom !== undefined ? normaliserNom(corps.nom) : null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const doc = await ligneDocument(id, client);
    const avant = await ligneQr(client, id, qrId);
    let resultat = { ...avant };

    if (nouveauNom && nouveauNom !== avant.numero) {
      const parapheurId = await parapheurPourNom(client, nouveauNom, doc.name);
      // En mode « numéro », le contenu encodé suit le nom ; en mode « jeton », il ne change pas.
      const contenu = avant.content === avant.reference ? avant.content : nouveauNom;
      await client.query('UPDATE qr_codes SET numero = $2, content = $3, parapheur_id = $4 WHERE id = $1',
        [qrId, nouveauNom, contenu, parapheurId]);
      const maj = await client.query('UPDATE noms_qr SET numero = $2 WHERE qr_code_id = $1', [qrId, nouveauNom]);
      if (!maj.rowCount) {
        const { rows } = await client.query(
          'INSERT INTO noms_qr (numero, qr_code_id) VALUES ($1, $2) ON CONFLICT (numero) DO NOTHING RETURNING numero',
          [nouveauNom, qrId],
        );
        if (!rows.length) throw nomDejaPris(nouveauNom);
      }
      await nettoyerParapheursQr(client, [avant.parapheur_id]);
      await marquerEnEdition(client, id);
      await historiser(client, id, utilisateur, 'renommage_qr', `Renommage du QR code ${avant.numero || avant.reference} en ${nouveauNom}`,
        { ancien: avant.numero, nouveau: nouveauNom });
      resultat = { ...resultat, numero: nouveauNom, content: contenu, parapheur_id: parapheurId };
    }

    if (!CHAMPS_POSITION.some(c => corps[c] !== undefined)) {
      await client.query('COMMIT');
      return serialiserQr(resultat);
    }

    const pos = lirePosition(corps);
    controlerPosition(pos, doc);
    const page = doc.pages[pos.page_number - 1];

    const change = Number(avant.position_x) !== pos.position_x || Number(avant.position_y) !== pos.position_y
      || Number(avant.width) !== pos.width || avant.page_number !== pos.page_number;
    if (change) {
      await client.query(
        `UPDATE qr_code_positions SET page_number=$2, position_x=$3, position_y=$4, width=$5, height=$6,
                page_largeur=$7, page_hauteur=$8, page_rotation=$9, updated_at=NOW() WHERE qr_code_id=$1`,
        [qrId, pos.page_number, pos.position_x, pos.position_y, pos.width, pos.height, page.largeur, page.hauteur, page.rotation || 0],
      );
      await marquerEnEdition(client, id);
      await historiser(client, id, utilisateur, 'modification_position', `Modification du positionnement du QR code ${avant.numero || avant.reference}`, {
        reference: avant.reference,
        avant: { page: avant.page_number, x: Number(avant.position_x), y: Number(avant.position_y), taille: Number(avant.width) },
        apres: { page: pos.page_number, x: pos.position_x, y: pos.position_y, taille: pos.width },
      });
    }
    await client.query('COMMIT');
    return serialiserQr({ ...resultat, ...pos });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505' && nouveauNom) throw nomDejaPris(nouveauNom);
    throw err;
  } finally {
    client.release();
  }
}

async function supprimerQr(id, qrId, utilisateur) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ligneDocument(id, client);
    const qr = await ligneQr(client, id, qrId);
    await client.query('DELETE FROM qr_codes WHERE id = $1', [qrId]);
    await nettoyerParapheursQr(client, [qr.parapheur_id]);
    await marquerEnEdition(client, id);
    await historiser(client, id, utilisateur, 'suppression_qr', `Suppression du QR code ${qr.numero || qr.reference}`,
      { numero: qr.numero, reference: qr.reference, page: qr.page_number });
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* ======================================================================
 * Génération (§3.5) — la couche d'édition ne fournit que des positions ;
 * le moteur adapté au format est choisi ici.
 * ==================================================================== */

const generationsEnCours = new Set();

function nomGenere(nom, format) {
  return `${nom.replace(/\.[^.]+$/, '')}_QR.${format}`;
}

/** Choisit, pour une page, le paragraphe d'ancrage du QR code dans le DOCX. */
function paragrapheAncrage(ancrages, page) {
  const candidats = (ancrages || []).filter(a => a.page === page);
  const hors = candidats.find(a => !a.t);
  return (hors || candidats[0])?.p ?? null;
}

async function moteurDocx(doc, original, qrs) {
  const placements = qrs.map(q => {
    const paragraphe = paragrapheAncrage(doc.ancrages, q.page);
    if (paragraphe === null) {
      throw new ErreurMetier(`Aucun paragraphe ne commence sur la page ${q.page} : le QR code ${q.reference} ne peut pas y être ancré dans le document Word. Placez-le sur une autre page ou exportez en PDF.`, 422);
    }
    return {
      paragraphe,
      reference: q.reference,
      png: q.png,
      emu: {
        x: pdfOutils.pointsVersEmu(q.x),
        y: pdfOutils.pointsVersEmu(q.y),
        cx: pdfOutils.pointsVersEmu(q.largeur),
        cy: pdfOutils.pointsVersEmu(q.hauteur),
      },
    };
  });
  const docx = await ooxml.insererQrCodes(original, placements);

  // Conversion de contrôle en PDF : vérifie que le document modifié se lit et
  // conserve la même pagination que l'aperçu (§3.5 B).
  const controle = await libreoffice.docxVersPdf(docx);
  const pagesControle = await pdfOutils.infosPages(controle);
  if (pagesControle.length !== doc.pages.length) {
    throw new ErreurMetier(`Le document Word généré compte ${pagesControle.length} page(s) au lieu de ${doc.pages.length} : la mise en page a été altérée, génération annulée.`, 422);
  }
  return { docx, controle };
}

async function generer(id, format, utilisateur) {
  if (!['pdf', 'docx'].includes(format)) throw new ErreurMetier('Format de sortie invalide (pdf ou docx).');
  if (generationsEnCours.has(id)) throw new ErreurMetier('Une génération est déjà en cours pour ce document.', 409);
  generationsEnCours.add(id);
  const debut = Date.now();
  try {
    const doc = await ligneDocument(id);
    const lignes = await lignesQr(id);
    if (!lignes.length) throw new ErreurMetier('Ajoutez au moins un QR code avant de générer le document.', 422);

    const qrs = [];
    for (const l of lignes) {
      const q = { reference: l.reference, contenu: l.content, page: l.page_number, x: Number(l.position_x), y: Number(l.position_y), largeur: Number(l.width), hauteur: Number(l.height) };
      const erreur = pdfOutils.verifierPosition({ page_number: q.page, position_x: q.x, position_y: q.y, width: q.largeur, height: q.hauteur }, doc.pages);
      if (erreur) throw new ErreurMetier(`QR code ${q.reference} : ${erreur}`, 422);
      try {
        q.png = await pngQr(q.contenu);
      } catch {
        throw new ErreurMetier(`Le QR code ${q.reference} est invalide.`, 422);
      }
      qrs.push(q);
    }

    let sortie;
    if (doc.original_format === 'pdf') {
      // Base : le PDF importé, ou le PDF issu de la conversion d'un document Word / ODT.
      const base = await stockage.lire(doc.preview_path || doc.original_path);
      const pdf = await pdfOutils.genererPdfAvecQr(base, qrs);
      sortie = format === 'pdf' ? pdf : await libreoffice.pdfVersDocx(pdf);
    } else {
      // Documents Word importés avant la conversion systématique en PDF.
      const original = await stockage.lire(doc.original_path);
      const { docx, controle } = await moteurDocx(doc, original, qrs);
      sortie = format === 'docx' ? docx : controle;
    }

    const chemin = await stockage.ecrire(stockage.cheminRelatif(id, `genere.${format}`), sortie);
    const nom = nomGenere(doc.name, format);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE documents SET generated_path=$2, generated_name=$3, generated_format=$4, generated_at=NOW(),
                status='genere', updated_at=NOW() WHERE id=$1`,
        [id, chemin, nom, format],
      );
      await historiser(client, id, utilisateur, 'generation', `Génération du document ${format.toUpperCase()} (${qrs.length} QR code(s))`, {
        format, nb_qr: qrs.length, duree_ms: Date.now() - debut, taille: sortie.length,
        reconstruction: doc.original_format === 'pdf' && format === 'docx',
      });
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return serialiserDocument(await ligneDocument(id));
  } catch (err) {
    // Une génération échouée ne produit jamais de document présenté comme valide (§7.3) :
    // l'original et la version générée précédente restent intacts.
    if (err.statut !== 404) {
      await historiser(pool, id, utilisateur, 'generation', `Échec de la génération ${format.toUpperCase()} : ${err.message}`, { format, echec: true })
        .catch(() => {});
    }
    if (err instanceof libreoffice.ErreurConversion) throw new ErreurMetier(err.message, 422);
    if (err instanceof pdfOutils.ErreurPdf || err instanceof ooxml.ErreurDocx) throw new ErreurMetier(err.message, 422);
    throw err;
  } finally {
    generationsEnCours.delete(id);
  }
}

/* ======================================================================
 * Exportation / téléchargement (§3.6)
 * ==================================================================== */

async function exporter(id, version, utilisateur) {
  const doc = await ligneDocument(id);
  if (version === 'original') {
    return { octets: await stockage.lire(doc.original_path), nom: doc.name, mime: MIME[doc.source_format || doc.original_format] };
  }
  if (!doc.generated_path) throw new ErreurMetier("Aucun document généré : lancez d'abord la génération.", 404);
  const octets = await stockage.lire(doc.generated_path);
  await historiser(pool, id, utilisateur, 'export', `Exportation du document ${doc.generated_name}`, { format: doc.generated_format });
  return { octets, nom: doc.generated_name, mime: MIME[doc.generated_format] };
}

async function historique(id) {
  await ligneDocument(id);
  const { rows } = await pool.query(
    'SELECT id, action, details, user_id, user_role, user_name, created_at FROM document_history WHERE document_id = $1 ORDER BY created_at DESC, id',
    [id],
  );
  return rows.map(r => ({
    id: r.id,
    action: r.action,
    description: r.details?.description || r.action,
    details: r.details,
    user_id: r.user_id,
    user_role: r.user_role,
    user_name: r.user_name || '—',
    created_at: r.created_at,
  }));
}

async function supprimer(id) {
  await ligneDocument(id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT parapheur_id FROM qr_codes WHERE document_id = $1', [id]);
    await client.query('DELETE FROM documents WHERE id = $1', [id]);
    // Les parapheurs DEP jamais scannés de ce document sont retirés (leurs numéros ne sont pas réutilisés).
    await nettoyerParapheursQr(client, rows.map(r => r.parapheur_id));
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  await stockage.supprimerDocument(id);
}

module.exports = {
  ErreurMetier,
  convertirEnPdf,
  suggererNom,
  reserverNomVisiteur,
  libererNomVisiteur,
  obtenirConfig,
  modifierConfig,
  importer,
  lister,
  obtenir,
  apercu,
  modifier,
  creerQr,
  modifierQr,
  supprimerQr,
  generer,
  exporter,
  historique,
  supprimer,
  paragrapheAncrage,
};
