import client from '../../../api/client';
import { TAILLE_MAX_DEFAUT, FORMATS } from '../utils/validationFichier';
import { positionDepuisApi } from '../utils/coordonnees';
import { cleUnique } from '../utils/qr';
import * as local from './magasinLocal';

/*
 * Module documentaire — tout se passe dans le navigateur.
 *
 * Seul le NOM de chaque QR code est conservé par le serveur, afin de garantir
 * qu'aucun nom ne serve deux fois. Documents et QR codes restent dans le
 * navigateur (IndexedDB) ; le parapheur est créé au premier scan du QR code
 * par l'application mobile. Le serveur sert aussi, sans rien conserver, à
 * convertir les documents Word / OpenDocument en PDF.
 */

/* ======================================================================
 * Session (affichage uniquement)
 * ==================================================================== */

export function jetonActif() {
  return localStorage.getItem('admin_token') || localStorage.getItem('superviseur_token');
}

export function utilisateurActif() {
  try {
    if (localStorage.getItem('admin_token')) {
      const u = JSON.parse(localStorage.getItem('admin_user') || 'null') || {};
      return { ...u, role: 'admin' };
    }
    if (localStorage.getItem('superviseur_token')) {
      const u = JSON.parse(localStorage.getItem('superviseur_user') || 'null') || {};
      return { ...u, role: 'superviseur' };
    }
  } catch {
    // données de session illisibles
  }
  return null;
}

export function messageErreur(err, defaut = 'Une erreur est survenue.') {
  if (!err) return defaut;
  if (err.response?.data?.message) return err.response.data.message;
  if (err.response?.status === 413) return 'Le fichier dépasse la taille maximale acceptée par le serveur.';
  if (err.code === 'ECONNABORTED') return 'Le serveur met trop de temps à répondre. Réessayez.';
  if (err.request && !err.response) return 'Connexion au serveur impossible. Vérifiez votre connexion.';
  return err.message || defaut;
}

/** Configuration du module (taille maximale des fichiers). */
export function detecterMode() {
  return Promise.resolve({ mode: 'local', config: { taille_max_octets: TAILLE_MAX_DEFAUT } });
}

export const STATUTS_DOCUMENT = {
  importe:    { label: 'Importé',    classe: 'badge-gris' },
  en_edition: { label: 'En édition', classe: 'badge-orange' },
  genere:     { label: 'Généré',     classe: 'badge-vert' },
  erreur:     { label: 'Erreur',     classe: 'badge-rouge' },
};

/* ======================================================================
 * Modèle d'un document (stocké dans le navigateur)
 * ==================================================================== */

function normaliserQr(q) {
  return {
    cle: q.id || cleUnique(),
    id: null,
    reference: q.reference,
    numero: q.numero ?? null, // nom du QR code = numéro du parapheur encodé
    cleNom: q.cleNom ?? null, // clé permettant de libérer le nom réservé
    contenu: q.contenu,
    ...positionDepuisApi(q),
  };
}

function normaliserDocument(d) {
  if (!d) return null;
  const qrcodes = Array.isArray(d.qrcodes) ? d.qrcodes.map(normaliserQr) : [];
  return {
    id: d.id,
    nom: d.nom,
    format: (d.format || 'pdf').toLowerCase(),
    // Format du fichier importé (Word / ODT convertis en PDF, format de travail).
    sourceFormat: (d.sourceFormat || d.format || 'pdf').toLowerCase(),
    statut: d.statut || 'importe',
    nomGenere: d.nomGenere ?? null,
    formatGenere: d.formatGenere ?? null,
    genere: Boolean(d.nomGenere),
    creeLe: d.creeLe,
    modifieLe: d.modifieLe,
    genereLe: d.genereLe ?? null,
    creePar: d.creePar ?? null,
    taille: d.taille ?? null,
    nbQr: qrcodes.length,
    qrcodes,
  };
}

function nomSansExtension(nom) {
  return nom.replace(/\.[^.]+$/, '');
}

/**
 * Nom du fichier généré : le(s) nom(s) des QR codes, ex. « DEP-000012.pdf »,
 * « DEP-000012_DEP-000013.pdf », « A_B_C_et_2_autres.pdf ».
 * À défaut de QR code nommé : le nom du document.
 */
export function nomFichierGenere(doc, format) {
  const noms = [...new Set((doc.qrcodes || []).map(q => q.numero || q.reference).filter(Boolean))];
  if (!noms.length) return `${nomSansExtension(doc.nom)}_QR.${format}`;
  const base = noms.length <= 3 ? noms.join('_') : `${noms.slice(0, 3).join('_')}_et_${noms.length - 3}_autres`;
  return `${base}.${format}`;
}

/* ======================================================================
 * Historique des opérations (§3.8), conservé avec le document
 * ==================================================================== */

function evenement(action, description, details = {}) {
  const u = utilisateurActif();
  return {
    id: cleUnique(),
    action,
    description,
    details,
    utilisateur: u?.nom || u?.identifiant || 'Visiteur',
    date: new Date().toISOString(),
  };
}

async function journaliser(id, ...evenements) {
  const doc = await local.obtenirDocumentLocal(id);
  if (!doc) return;
  doc.historique = [...(doc.historique || []), ...evenements];
  doc.modifieLe = new Date().toISOString();
  await local.enregistrerDocumentLocal(doc);
}

/* ======================================================================
 * Importation
 * ==================================================================== */

/** Conversion Word / ODT → PDF par le serveur (rien n'y est conservé). */
async function convertirEnPdfServeur(fichier, onProgression) {
  const fd = new FormData();
  fd.append('fichier', fichier);
  try {
    const { data } = await client.post('/documents/conversion-pdf', fd, {
      responseType: 'arraybuffer',
      timeout: 180000,
      onUploadProgress: e => e.total && onProgression?.(Math.round((e.loaded / e.total) * 60)),
    });
    return data;
  } catch (err) {
    // Le corps d'erreur arrive en ArrayBuffer : on en extrait le message JSON.
    let message = null;
    try {
      message = JSON.parse(new TextDecoder().decode(err.response?.data))?.message;
    } catch {
      // corps non JSON
    }
    if (err.response?.status === 404) message = "Le service de conversion des documents Word n'est pas disponible sur le serveur. Importez un PDF.";
    throw new Error(message || messageErreur(err, 'La conversion du document en PDF a échoué.'), { cause: err });
  }
}

/** Importation (§3.1) : le fichier a déjà été validé (extension, type réel, taille). */
export async function importerDocument(fichier, { format, aConvertir }, onProgression) {
  const octetsSource = await fichier.arrayBuffer();
  const octetsPdf = aConvertir ? await convertirEnPdfServeur(fichier, onProgression) : octetsSource;
  onProgression?.(90);
  const id = cleUnique();
  const maintenant = new Date().toISOString();
  const u = utilisateurActif();
  const doc = {
    id,
    nom: fichier.name,
    format: 'pdf',
    sourceFormat: format,
    statut: 'importe',
    creeLe: maintenant,
    modifieLe: maintenant,
    creePar: u?.nom || u?.identifiant || null,
    taille: fichier.size,
    qrcodes: [],
    historique: [evenement('import', `Importation du document « ${fichier.name} »`, { taille: fichier.size, format })],
  };
  if (aConvertir) {
    doc.historique.push(evenement('conversion', `Conversion du document ${FORMATS[format].label} en PDF`, { format_source: format }));
  }
  // « original » = PDF de travail ; « source » = fichier importé tel quel (Word / ODT).
  await local.enregistrerFichierLocal(id, 'original', octetsPdf);
  if (aConvertir) await local.enregistrerFichierLocal(id, 'source', octetsSource);
  await local.enregistrerDocumentLocal(doc);
  onProgression?.(100);
  return normaliserDocument(doc);
}

export async function obtenirDocument(id) {
  const doc = await local.obtenirDocumentLocal(id);
  if (!doc) {
    const err = new Error('Ce document est introuvable. Les documents ne sont disponibles que dans le navigateur où ils ont été importés.');
    err.introuvable = true;
    throw err;
  }
  return normaliserDocument(doc);
}

/** PDF de travail (PDF importé, ou issu de la conversion Word / ODT). */
export async function obtenirApercu(id) {
  const octets = await local.obtenirFichierLocal(id, 'original');
  if (!octets) throw new Error('Le fichier du document est introuvable dans ce navigateur.');
  return octets;
}

/* ======================================================================
 * Noms des QR codes : choisis par l'utilisateur, uniques. Seule donnée
 * conservée par le serveur (registre des noms).
 * ==================================================================== */

export const MOTIF_NOM_QR = /^[A-Z0-9][A-Z0-9-]{0,49}$/;

export function normaliserNomQr(nom) {
  return String(nom ?? '').trim().toUpperCase();
}

function erreurServeurNoms(err, defaut) {
  if (err.response?.status === 404) {
    return new Error("Le serveur ne gère pas encore les noms de QR codes : il doit être mis à jour avec la dernière version.", { cause: err });
  }
  return new Error(messageErreur(err, defaut), { cause: err });
}

/** Proposition de nom libre (DEP-000001…), modifiable par l'utilisateur. */
export async function suggererNomQr() {
  try {
    const { data } = await client.get('/documents/noms-qr/suggestion');
    return data.nom;
  } catch {
    return ''; // la suggestion est facultative
  }
}

/** Libère le nom d'un QR code supprimé (avec la clé reçue à la réservation). */
async function libererNom(q) {
  if (!q?.cleNom || !q?.numero) return;
  await client.delete(`/documents/noms-qr/${encodeURIComponent(q.numero)}`, { headers: { 'X-Cle-Nom': q.cleNom } }).catch(() => {});
}

/**
 * Création d'un QR code avec le nom choisi : le nom est réservé sur le serveur
 * (refusé s'il est déjà utilisé) ; le parapheur sera créé au premier scan.
 */
export async function creerQr(docId, { nom, position }) {
  let reservation;
  try {
    ({ data: reservation } = await client.post('/documents/noms-qr', { nom }));
  } catch (err) {
    throw erreurServeurNoms(err, "Le nom du QR code n'a pas pu être réservé.");
  }
  return {
    ...position,
    cle: cleUnique(),
    id: null,
    reference: reservation.nom,
    numero: reservation.nom,
    contenu: reservation.nom,
    cleNom: reservation.cle,
  };
}

/* ======================================================================
 * Enregistrement, génération, téléchargement, impression
 * ==================================================================== */

/** Enregistrement (automatique) de l'état de l'éditeur dans le navigateur. */
export async function enregistrerEdition(docId, { qrcodes, supprimes, initiaux }) {
  const doc = await local.obtenirDocumentLocal(docId);
  const evts = [];
  const nom = q => q.numero || q.reference;
  const avant = new Map((initiaux || []).map(q => [q.cle, q]));
  for (const q of qrcodes) {
    const a = avant.get(q.cle);
    if (!a) evts.push(evenement('ajout_qr', `Ajout du QR code ${nom(q)} (page ${q.page})`, { numero: q.numero, page: q.page }));
    else if (a.x !== q.x || a.y !== q.y || a.largeur !== q.largeur || a.page !== q.page) {
      evts.push(evenement('modification_position', `Modification du positionnement du QR code ${nom(q)}`, {
        numero: q.numero, avant: { page: a.page, x: a.x, y: a.y, taille: a.largeur }, apres: { page: q.page, x: q.x, y: q.y, taille: q.largeur },
      }));
    }
  }
  for (const q of supprimes) {
    await libererNom(q); // le nom redevient disponible
    if (avant.has(q.cle)) evts.push(evenement('suppression_qr', `Suppression du QR code ${nom(q)}`, { numero: q.numero }));
  }
  Object.assign(doc, {
    qrcodes: qrcodes.map(({ cle, reference, numero, contenu, cleNom, page, x, y, largeur, hauteur }) => ({ id: cle, reference, numero, contenu, cleNom, page, x, y, largeur, hauteur })),
    // Toute modification des QR codes rend le document généré obsolète.
    statut: evts.length || doc.statut !== 'genere' ? (qrcodes.length ? 'en_edition' : 'importe') : 'genere',
    historique: [...(doc.historique || []), ...evts],
    modifieLe: new Date().toISOString(),
  });
  await local.enregistrerDocumentLocal(doc);
  return normaliserDocument(doc);
}

/** Génération du PDF avec les QR codes (§3.5). */
export async function genererDocument(docId) {
  const doc = await local.obtenirDocumentLocal(docId);
  const original = await local.obtenirFichierLocal(docId, 'original');
  try {
    const { genererPdfAvecQr } = await import('./generationPdf');
    const octets = await genererPdfAvecQr(original, doc.qrcodes);
    await local.enregistrerFichierLocal(docId, 'genere', octets);
    Object.assign(doc, {
      statut: 'genere',
      nomGenere: nomFichierGenere(doc, 'pdf'),
      formatGenere: 'pdf',
      genereLe: new Date().toISOString(),
    });
    doc.historique = [...(doc.historique || []), evenement('generation', `Génération du document PDF (${doc.qrcodes.length} QR code(s))`, { nb_qr: doc.qrcodes.length })];
    await local.enregistrerDocumentLocal(doc);
    return normaliserDocument(doc);
  } catch (err) {
    // Une génération échouée ne produit jamais de document présenté comme valide (§7.3).
    doc.historique = [...(doc.historique || []), evenement('generation', `Échec de la génération : ${err.message}`, { echec: true })];
    await local.enregistrerDocumentLocal(doc);
    throw err;
  }
}

/**
 * Lance le téléchargement et renvoie { url, nom } : certains navigateurs intégrés
 * (ex. celui de VS Code) bloquent le téléchargement automatique ; l'interface
 * propose alors un lien de secours vers ce même fichier (conservé 10 minutes).
 */
function declencherTelechargement(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
  return { url, nom };
}

const MIME = Object.fromEntries(Object.entries(FORMATS).map(([cle, f]) => [cle, f.mime]));

/** PDF avec QR codes à jour : (re)généré si nécessaire. Renvoie { doc, octets }. */
async function pdfAvecQrAJour(doc) {
  if (!doc.nbQr && !doc.qrcodes?.length) throw new Error("Ajoutez d'abord un QR code.");
  const aJour = doc.genere && doc.statut === 'genere';
  const genere = aJour ? doc : await genererDocument(doc.id);
  const octets = await local.obtenirFichierLocal(doc.id, 'genere');
  if (!octets) throw new Error("Le document avec QR codes n'a pas pu être préparé.");
  return { doc: genere, octets };
}

/** Télécharge le document original (tel qu'importé : PDF, Word ou ODT). */
export async function telechargerOriginal(doc) {
  const converti = doc.sourceFormat && doc.sourceFormat !== doc.format;
  const octets = await local.obtenirFichierLocal(doc.id, converti ? 'source' : 'original');
  if (!octets) throw new Error('Fichier original introuvable.');
  return declencherTelechargement(new Blob([octets], { type: MIME[doc.sourceFormat || doc.format] }), doc.nom);
}

/** Télécharge le PDF avec les QR codes (généré si nécessaire). Renvoie { doc, fichier }. */
export async function telechargerAvecQr(doc) {
  const { doc: genere, octets } = await pdfAvecQrAJour(doc);
  const fichier = declencherTelechargement(new Blob([octets], { type: 'application/pdf' }), genere.nomGenere);
  await journaliser(doc.id, evenement('export', `Téléchargement du document ${genere.nomGenere}`, {}));
  return { doc: genere, fichier };
}

/** PDF avec QR codes à imprimer, sans téléchargement. Renvoie { doc, octets }. */
export async function obtenirPdfAvecQr(doc) {
  const resultat = await pdfAvecQrAJour(doc);
  await journaliser(doc.id, evenement('impression', `Impression du document ${resultat.doc.nomGenere || ''}`.trim(), {}));
  return resultat;
}
