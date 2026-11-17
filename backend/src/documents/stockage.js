/**
 * Stockage des fichiers documentaires (cahier des charges §7.2, §7.3).
 *   <UPLOADS_DIR>/documents/<id>/original.<ext>   — jamais réécrit
 *   <UPLOADS_DIR>/documents/<id>/apercu.pdf       — aperçu (conversion du DOCX)
 *   <UPLOADS_DIR>/documents/<id>/genere.<ext>     — dernière version générée
 * Les chemins stockés en base sont relatifs à la racine ; toute résolution est
 * contrôlée pour empêcher une sortie de la racine.
 */
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const RACINE = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads'), 'documents');

function resoudre(relatif) {
  const absolu = path.resolve(RACINE, relatif);
  if (absolu !== RACINE && !absolu.startsWith(RACINE + path.sep)) {
    throw new Error('Chemin de stockage invalide.');
  }
  return absolu;
}

function cheminRelatif(documentId, nom) {
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) throw new Error('Identifiant de document invalide.');
  return path.posix.join(documentId, nom);
}

/** Écriture atomique : fichier temporaire puis renommage (jamais de fichier partiel). */
async function ecrire(relatif, octets) {
  const cible = resoudre(relatif);
  await fs.mkdir(path.dirname(cible), { recursive: true, mode: 0o750 });
  const tmp = `${cible}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  await fs.writeFile(tmp, octets, { mode: 0o640 });
  await fs.rename(tmp, cible);
  return relatif;
}

/** Écrit un fichier uniquement s'il n'existe pas encore (protection de l'original). */
async function ecrireNouveau(relatif, octets) {
  const cible = resoudre(relatif);
  await fs.mkdir(path.dirname(cible), { recursive: true, mode: 0o750 });
  await fs.writeFile(cible, octets, { flag: 'wx', mode: 0o640 });
  return relatif;
}

function lire(relatif) {
  return fs.readFile(resoudre(relatif));
}

async function supprimerDocument(documentId) {
  await fs.rm(resoudre(documentId), { recursive: true, force: true });
}

module.exports = { RACINE, cheminRelatif, ecrire, ecrireNouveau, lire, supprimerDocument, resoudre };
