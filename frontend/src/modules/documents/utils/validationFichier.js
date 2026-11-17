/**
 * FileValidator — cahier des charges §3.1 et §7.2
 * Vérifie l'extension ET le type réel (signature binaire) du fichier.
 */

export const TAILLE_MAX_DEFAUT = 20 * 1024 * 1024; // 20 Mo, remplacée par la config serveur

export const FORMATS = {
  pdf:  { label: 'PDF',          extension: '.pdf',  mime: 'application/pdf' },
  docx: { label: 'Word',         extension: '.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  doc:  { label: 'Word 97-2003', extension: '.doc',  mime: 'application/msword' },
  odt:  { label: 'OpenDocument', extension: '.odt',  mime: 'application/vnd.oasis.opendocument.text' },
};

/** Formats convertis en PDF à l'import (le PDF devient le document de travail). */
export const FORMATS_A_CONVERTIR = ['docx', 'doc', 'odt'];

export const ACCEPT_INPUT = [
  ...Object.values(FORMATS).map(f => f.extension),
  ...Object.values(FORMATS).map(f => f.mime),
].join(',');

export function formaterTaille(octets) {
  if (octets == null) return '—';
  if (octets >= 1024 * 1024) return `${(octets / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
  return `${Math.max(1, Math.round(octets / 1024))} Ko`;
}

function extensionDe(nom) {
  const i = nom.lastIndexOf('.');
  return i >= 0 ? nom.slice(i + 1).toLowerCase() : '';
}

function contientAscii(octets, texte, limite = octets.length) {
  const cible = Array.from(texte, c => c.charCodeAt(0));
  const fin = Math.min(limite, octets.length) - cible.length;
  for (let i = 0; i <= fin; i++) {
    let ok = true;
    for (let j = 0; j < cible.length; j++) {
      if (octets[i + j] !== cible[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

/**
 * @returns {Promise<{ format: 'pdf'|'docx' }>} ou lève une Error au message explicatif.
 */
export async function validerFichier(fichier, tailleMax = TAILLE_MAX_DEFAUT) {
  if (!fichier) throw new Error('Aucun fichier sélectionné.');

  const ext = extensionDe(fichier.name);
  if (!FORMATS[ext]) {
    throw new Error(`Format non pris en charge (.${ext || '?'}). Formats acceptés : PDF (.pdf), Word (.docx, .doc) et OpenDocument (.odt).`);
  }
  if (fichier.size === 0) {
    throw new Error('Le fichier est vide.');
  }
  if (fichier.size > tailleMax) {
    throw new Error(`Le fichier fait ${formaterTaille(fichier.size)}, la taille maximale autorisée est de ${formaterTaille(tailleMax)}.`);
  }

  const octets = new Uint8Array(await fichier.arrayBuffer());

  if (ext === 'pdf') {
    // La signature %PDF- doit apparaître dans le premier kilo-octet.
    if (!contientAscii(octets, '%PDF-', 1024)) {
      throw new Error("Ce fichier porte l'extension .pdf mais n'est pas un PDF valide (fichier corrompu ou renommé).");
    }
    if (!contientAscii(octets.subarray(Math.max(0, octets.length - 2048)), '%%EOF')) {
      throw new Error('Le PDF semble incomplet ou corrompu (marqueur de fin absent).');
    }
  } else if (ext === 'doc') {
    // Word 97-2003 : conteneur OLE (D0 CF 11 E0 A1 B1 1A E1).
    const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    if (!ole.every((o, i) => octets[i] === o)) {
      throw new Error("Ce fichier porte l'extension .doc mais n'est pas un document Word valide (fichier corrompu ou renommé).");
    }
  } else {
    // .docx et .odt sont des archives ZIP (PK\x03\x04).
    if (!(octets[0] === 0x50 && octets[1] === 0x4b && octets[2] === 0x03 && octets[3] === 0x04)) {
      throw new Error(`Ce fichier porte l'extension .${ext} mais n'est pas un document ${FORMATS[ext].label} valide (fichier corrompu ou renommé).`);
    }
    if (ext === 'docx' && !contientAscii(octets, 'word/')) {
      throw new Error("Cette archive n'est pas un document Word (.docx) valide.");
    }
    // Le fichier « mimetype » est stocké en premier, non compressé, dans un .odt.
    if (ext === 'odt' && !contientAscii(octets, 'application/vnd.oasis.opendocument.text', 200)) {
      throw new Error("Ce fichier n'est pas un document texte OpenDocument (.odt) valide.");
    }
  }

  return { format: ext, aConvertir: FORMATS_A_CONVERTIR.includes(ext) };
}
