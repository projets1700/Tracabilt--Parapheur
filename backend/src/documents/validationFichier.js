/**
 * Validation des fichiers importés (cahier des charges §3.1, §7.2) :
 * extension, type réel (signature binaire + structure), taille, intégrité.
 */
const JSZip = require('jszip');
const { chargerPdf } = require('./pdfOutils');

class ErreurValidation extends Error {
  constructor(message, statut = 400) {
    super(message);
    this.statut = statut;
  }
}

function extension(nom) {
  const i = nom.lastIndexOf('.');
  return i >= 0 ? nom.slice(i + 1).toLowerCase() : '';
}

/** Nettoie un nom de fichier fourni par le client (affichage / téléchargement). */
function nettoyerNom(nom) {
  const base = String(nom || 'document')
    .replace(/[\\/]/g, '_')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>:"|?*]/g, '')
    .trim()
    .slice(0, 200);
  return base || 'document';
}

/** Formats acceptés : PDF, et documents texte convertis en PDF à l'import. */
const FORMATS_ACCEPTES = ['pdf', 'docx', 'doc', 'odt'];
const FORMATS_A_CONVERTIR = ['docx', 'doc', 'odt'];
const SIGNATURE_ZIP = [0x50, 0x4b, 0x03, 0x04];
const SIGNATURE_OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // .doc (Word 97-2003)
const TAILLE_DECOMPRESSEE_MAX = 300 * 1024 * 1024;

const commencePar = (octets, signature) => signature.every((o, i) => octets[i] === o);

/** Ouvre une archive (docx) et vérifie qu'elle contient l'entrée attendue (+ protection « bombe ZIP »). */
async function verifierArchive(octets, entree, messageAbsence) {
  let zip;
  try {
    zip = await JSZip.loadAsync(octets);
  } catch {
    throw new ErreurValidation("Le fichier n'est pas un document Word valide (archive illisible).", 422);
  }
  let total = 0;
  zip.forEach((_, f) => { total += f._data?.uncompressedSize || 0; });
  if (total > TAILLE_DECOMPRESSEE_MAX) throw new ErreurValidation('Le document est anormalement volumineux une fois décompressé.', 422);
  if (!zip.file(entree)) throw new ErreurValidation(messageAbsence, 422);
}

async function verifierOdt(octets) {
  let zip;
  try {
    zip = await JSZip.loadAsync(octets);
  } catch {
    throw new ErreurValidation("Le fichier n'est pas un document OpenDocument valide (archive illisible).", 422);
  }
  let total = 0;
  zip.forEach((_, f) => { total += f._data?.uncompressedSize || 0; });
  if (total > TAILLE_DECOMPRESSEE_MAX) throw new ErreurValidation('Le document est anormalement volumineux une fois décompressé.', 422);
  const type = zip.file('mimetype') ? (await zip.file('mimetype').async('string')).trim() : '';
  if (type !== 'application/vnd.oasis.opendocument.text' || !zip.file('content.xml')) {
    throw new ErreurValidation("Ce fichier n'est pas un document texte OpenDocument (.odt).", 415);
  }
}

async function validerFichier(nomOriginal, octets, tailleMax) {
  const ext = extension(nomOriginal);
  if (!FORMATS_ACCEPTES.includes(ext)) {
    throw new ErreurValidation('Format non pris en charge. Formats acceptés : PDF (.pdf), Word (.docx, .doc) et OpenDocument (.odt).', 415);
  }
  if (!octets?.length) throw new ErreurValidation('Le fichier est vide.');
  if (octets.length > tailleMax) throw new ErreurValidation('Le fichier dépasse la taille maximale autorisée.', 413);

  if (ext === 'pdf') {
    if (!octets.subarray(0, 1024).includes('%PDF-')) {
      throw new ErreurValidation("Ce fichier porte l'extension .pdf mais n'est pas un PDF valide.", 415);
    }
    try {
      const pdf = await chargerPdf(octets);
      if (!pdf.getPageCount()) throw new Error('vide');
    } catch (err) {
      throw new ErreurValidation(err.message === 'vide' ? 'Le PDF ne contient aucune page.' : err.message, 422);
    }
  } else if (ext === 'doc') {
    if (!commencePar(octets, SIGNATURE_OLE)) {
      throw new ErreurValidation("Ce fichier porte l'extension .doc mais n'est pas un document Word valide.", 415);
    }
  } else if (ext === 'odt') {
    if (!commencePar(octets, SIGNATURE_ZIP)) {
      throw new ErreurValidation("Ce fichier porte l'extension .odt mais n'est pas un document OpenDocument valide.", 415);
    }
    await verifierOdt(octets);
  } else {
    if (!commencePar(octets, SIGNATURE_ZIP)) {
      throw new ErreurValidation("Ce fichier porte l'extension .docx mais n'est pas un document Word valide.", 415);
    }
    await verifierArchive(octets, 'word/document.xml', "Cette archive n'est pas un document Word (.docx) valide.");
  }
  return { format: ext, aConvertir: FORMATS_A_CONVERTIR.includes(ext) };
}

module.exports = { validerFichier, nettoyerNom, ErreurValidation, FORMATS_A_CONVERTIR };
