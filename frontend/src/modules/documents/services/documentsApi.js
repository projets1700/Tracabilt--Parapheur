import client from '../../../api/client';
import { TAILLE_MAX_DEFAUT, FORMATS } from '../utils/validationFichier';
import { positionVersApi, positionDepuisApi } from '../utils/coordonnees';
import { cleUnique } from '../utils/qr';
import * as local from './magasinLocal';

/* ======================================================================
 * Authentification : le module est accessible aux administrateurs ET
 * aux superviseurs.
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

function cfg(extra = {}) {
  return { ...extra, headers: { ...(extra.headers || {}), Authorization: `Bearer ${jetonActif()}` } };
}

export function messageErreur(err, defaut = 'Une erreur est survenue.') {
  if (!err) return defaut;
  if (err.response?.data?.message) return err.response.data.message;
  if (err.response?.status === 401 || err.response?.status === 403) return "Vous n'êtes pas autorisé à effectuer cette action. Reconnectez-vous.";
  if (err.response?.status === 413) return 'Le fichier dépasse la taille maximale acceptée par le serveur.';
  if (err.code === 'ECONNABORTED') return 'Le serveur met trop de temps à répondre. Réessayez.';
  if (err.request && !err.response) return 'Connexion au serveur impossible. Vérifiez votre connexion.';
  return err.message || defaut;
}

/* ======================================================================
 * Détection du mode : « serveur » si l'API documentaire répond,
 * « local » sinon (traitement des PDF dans le navigateur).
 * ==================================================================== */

let modePromesse = null;
let jetonDuMode = null;

/** Visiteur non connecté (accès public depuis le Visionneur). */
export function estVisiteur() {
  return !jetonActif();
}

export function detecterMode() {
  // Le mode dépend de la session : on le recalcule après une connexion / déconnexion.
  if (jetonDuMode !== jetonActif()) {
    modePromesse = null;
    jetonDuMode = jetonActif();
  }
  if (estVisiteur()) {
    // Visiteur : traitement 100 % navigateur, aucun envoi au serveur documentaire.
    return Promise.resolve({ mode: 'local', visiteur: true, config: { taille_max_octets: TAILLE_MAX_DEFAUT } });
  }
  if (!modePromesse) {
    modePromesse = client.get('/documents/config', cfg({ timeout: 8000 }))
      .then(({ data }) => ({
        mode: 'serveur',
        config: { taille_max_octets: Number(data?.taille_max_octets) || TAILLE_MAX_DEFAUT, ...data },
      }))
      .catch(err => {
        const s = err.response?.status;
        if (s === 401 || s === 403) {
          return { mode: 'serveur', config: { taille_max_octets: TAILLE_MAX_DEFAUT } };
        }
        // 404 (routes absentes) ou serveur injoignable : mode local.
        if (!err.response) modePromesse = null; // on retentera au prochain appel
        return { mode: 'local', config: { taille_max_octets: TAILLE_MAX_DEFAUT } };
      });
  }
  return modePromesse;
}

async function estServeur() {
  return (await detecterMode()).mode === 'serveur';
}

/* ======================================================================
 * Normalisation des objets renvoyés par l'API (modèle §6).
 * ==================================================================== */

export const STATUTS_DOCUMENT = {
  importe:    { label: 'Importé',    classe: 'badge-gris' },
  en_edition: { label: 'En édition', classe: 'badge-orange' },
  genere:     { label: 'Généré',     classe: 'badge-vert' },
  erreur:     { label: 'Erreur',     classe: 'badge-rouge' },
};

function normaliserQr(q) {
  const pos = q.position || q.positions?.[0] || q;
  return {
    cle: q.id || cleUnique(),
    id: q.id ?? null,
    reference: q.reference,
    // Numéro de parapheur unique du QR code (DEP-000001…).
    numero: q.numero ?? null,
    // Mode navigateur : clé permettant de libérer le nom réservé.
    cleNom: q.cleNom ?? null,
    contenu: q.content ?? q.contenu,
    ...positionDepuisApi(pos),
  };
}

function normaliserDocument(d) {
  if (!d) return null;
  const qrcodes = Array.isArray(d.qrcodes) ? d.qrcodes.map(normaliserQr) : undefined;
  return {
    id: d.id,
    nom: d.name ?? d.nom,
    format: (d.original_format ?? d.format ?? '').toLowerCase(),
    // Format du fichier importé (Word / ODT convertis en PDF, qui devient le format de travail).
    sourceFormat: (d.source_format ?? d.sourceFormat ?? d.original_format ?? d.format ?? '').toLowerCase(),
    statut: d.status ?? d.statut ?? 'importe',
    parapheurId: d.parapheur_id ?? d.parapheurId ?? null,
    parapheurNumero: d.parapheur_numero ?? d.parapheur?.numero ?? d.parapheurNumero ?? null,
    parapheurTitre: d.parapheur_titre ?? d.parapheur?.titre ?? d.parapheurTitre ?? null,
    nomGenere: d.generated_name ?? d.nomGenere ?? null,
    formatGenere: d.generated_format ?? d.formatGenere ?? null,
    genere: Boolean(d.generated_path || d.generated_name || d.nomGenere),
    creeLe: d.created_at ?? d.creeLe,
    modifieLe: d.updated_at ?? d.modifieLe,
    genereLe: d.generated_at ?? d.genereLe ?? null,
    creePar: d.created_by_name ?? d.creePar ?? null,
    taille: d.size ?? d.taille ?? null,
    nbQr: d.qr_count ?? d.nbQr ?? qrcodes?.length ?? 0,
    // Numéros DEP des QR codes du document.
    qrNumeros: d.qr_numeros
      ? String(d.qr_numeros).split(',').map(n => n.trim()).filter(Boolean)
      : (qrcodes || []).map(q => q.numero).filter(Boolean),
    qrcodes: qrcodes ?? [],
  };
}

function nomSansExtension(nom) {
  return nom.replace(/\.[^.]+$/, '');
}

/**
 * Nom du fichier généré : le(s) nom(s) des QR codes, ex. « DEP-000012.pdf »,
 * « DEP-000012_DEP-000013.pdf », « A_B_C_et_2_autres.pdf » (comme côté serveur).
 * À défaut de QR code nommé : le nom du document.
 */
export function nomFichierGenere(doc, format) {
  const noms = [...new Set((doc.qrcodes || []).map(q => q.numero || q.reference).filter(Boolean))];
  if (!noms.length) return `${nomSansExtension(doc.nom)}_QR.${format}`;
  const base = noms.length <= 3 ? noms.join('_') : `${noms.slice(0, 3).join('_')}_et_${noms.length - 3}_autres`;
  return `${base}.${format}`;
}

/* ======================================================================
 * Mode local : journal d'historique (§3.8).
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

async function journaliserLocal(id, ...evenements) {
  const doc = await local.obtenirDocumentLocal(id);
  if (!doc) return;
  doc.historique = [...(doc.historique || []), ...evenements];
  doc.modifieLe = new Date().toISOString();
  await local.enregistrerDocumentLocal(doc);
}

/* ======================================================================
 * API publique du module.
 * ==================================================================== */

export async function listerParapheurs() {
  const { data } = await client.get('/parapheurs?limite=500');
  return data.parapheurs || [];
}

export async function modifierConfig(config) {
  const { data } = await client.put('/documents/config', config, cfg());
  modePromesse = null;
  return data;
}

export async function listerDocuments({ parapheurId } = {}) {
  if (await estServeur()) {
    const params = parapheurId ? `?parapheur_id=${encodeURIComponent(parapheurId)}` : '';
    const { data } = await client.get(`/documents${params}`, cfg());
    return (data.documents || data || []).map(normaliserDocument);
  }
  const docs = await local.listerDocumentsLocaux();
  return docs
    .filter(d => !parapheurId || d.parapheurId === parapheurId)
    .sort((a, b) => (b.modifieLe || '').localeCompare(a.modifieLe || ''))
    .map(normaliserDocument);
}

/**
 * Importation (§3.1). Le fichier a déjà été validé côté client
 * (extension + type réel + taille) ; le serveur refait ses propres contrôles.
 */
/**
 * Conversion Word / ODT → PDF par la route publique du serveur (aucun stockage).
 * Utilisée en mode navigateur (visiteur non connecté).
 */
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

export async function importerDocument(fichier, { format, aConvertir }, onProgression) {
  if (await estServeur()) {
    const fd = new FormData();
    fd.append('fichier', fichier);
    const { data } = await client.post('/documents', fd, cfg({
      timeout: 120000,
      onUploadProgress: e => e.total && onProgression?.(Math.round((e.loaded / e.total) * 100)),
    }));
    return normaliserDocument(data.document || data);
  }

  const octetsSource = await fichier.arrayBuffer();
  let octetsPdf = octetsSource;
  if (aConvertir) {
    // Word / ODT : conversion en PDF par le serveur (rien n'y est conservé),
    // puis traitement du PDF dans le navigateur.
    octetsPdf = await convertirEnPdfServeur(fichier, onProgression);
  }
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
    parapheurId: null,
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
  if (await estServeur()) {
    const { data } = await client.get(`/documents/${id}`, cfg());
    return normaliserDocument(data.document ? { ...data.document, qrcodes: data.qrcodes ?? data.document.qrcodes } : data);
  }
  const doc = await local.obtenirDocumentLocal(id);
  if (!doc) {
    const err = new Error("Ce document est introuvable. En mode local, les documents ne sont disponibles que dans le navigateur où ils ont été importés.");
    err.introuvable = true;
    throw err;
  }
  return normaliserDocument(doc);
}

/** Aperçu PDF (PDF natif ou conversion temporaire du DOCX, §3.2). */
export async function obtenirApercu(id) {
  if (await estServeur()) {
    const { data } = await client.get(`/documents/${id}/preview`, cfg({ responseType: 'arraybuffer', timeout: 120000 }));
    return data;
  }
  const octets = await local.obtenirFichierLocal(id, 'original');
  if (!octets) throw new Error('Le fichier original est introuvable dans le stockage local.');
  return octets;
}

/* ======================================================================
 * Noms des QR codes : choisis par l'utilisateur, uniques (contrôlés par le
 * serveur). Le nom est le numéro de parapheur encodé dans le QR code.
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

/** Visiteur : libère un nom réservé (QR code supprimé ou renommé). */
async function libererNomLocal(q) {
  if (!q?.cleNom || !q?.numero) return;
  await client.delete(`/documents/noms-qr/${encodeURIComponent(q.numero)}`, { headers: { 'X-Cle-Nom': q.cleNom } }).catch(() => {});
}

/** Création d'un QR code (§3.3) avec le nom choisi par l'utilisateur. */
export async function creerQr(docId, { nom, position, page }) {
  if (await estServeur()) {
    try {
      const { data } = await client.post(`/documents/${docId}/qrcodes`, { nom, ...positionVersApi(position, page) }, cfg());
      const q = data.qrcode || data;
      return { ...position, ...normaliserQr({ ...q, position: q.position || positionVersApi(position, page) }), cle: q.id };
    } catch (err) {
      throw erreurServeurNoms(err, "Le QR code n'a pas pu être créé.");
    }
  }
  // Mode navigateur : le nom est réservé sur le serveur pour garantir son unicité ;
  // le parapheur sera créé au premier scan de l'application mobile.
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

/**
 * Renommage d'un QR code (le nouveau nom doit être libre).
 * Renvoie les champs à mettre à jour dans l'éditeur.
 */
export async function renommerQr(docId, qr, nom) {
  if (await estServeur()) {
    if (!qr.id) throw new Error('Enregistrez le document avant de renommer ce QR code.');
    try {
      const { data } = await client.put(`/documents/${docId}/qrcodes/${qr.id}`, { nom }, cfg());
      const q = data.qrcode || data;
      return { numero: q.numero, contenu: q.content };
    } catch (err) {
      throw erreurServeurNoms(err, "Le QR code n'a pas pu être renommé.");
    }
  }
  let reservation;
  try {
    ({ data: reservation } = await client.post('/documents/noms-qr', { nom }));
  } catch (err) {
    throw erreurServeurNoms(err, "Le nouveau nom n'a pas pu être réservé.");
  }
  await libererNomLocal(qr);
  return { numero: reservation.nom, reference: reservation.nom, contenu: reservation.nom, cleNom: reservation.cle };
}

/**
 * Enregistrement de l'état de l'éditeur : positions et suppressions.
 * Les événements sont historisés (§3.8).
 */
export async function enregistrerEdition(docId, { qrcodes, supprimes, pages, initiaux }) {
  if (await estServeur()) {
    for (const q of supprimes) {
      if (q.id) await client.delete(`/documents/${docId}/qrcodes/${q.id}`, cfg());
    }
    for (const q of qrcodes) {
      const corps = positionVersApi(q, pages[q.page - 1]);
      if (q.id) await client.put(`/documents/${docId}/qrcodes/${q.id}`, corps, cfg());
      else {
        const { data } = await client.post(`/documents/${docId}/qrcodes`, corps, cfg());
        q.id = (data.qrcode || data).id;
      }
    }
    return obtenirDocument(docId);
  }

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
    await libererNomLocal(q);
    if (avant.has(q.cle)) evts.push(evenement('suppression_qr', `Suppression du QR code ${nom(q)}`, { numero: q.numero }));
  }
  Object.assign(doc, {
    qrcodes: qrcodes.map(({ cle, reference, numero, contenu, cleNom, page, x, y, largeur, hauteur }) => ({ id: cle, reference, numero, contenu, cleNom, page, x, y, largeur, hauteur })),
    // Toute modification des QR codes rend le document généré obsolète (comme côté serveur).
    statut: evts.length || doc.statut !== 'genere' ? (qrcodes.length ? 'en_edition' : 'importe') : 'genere',
    historique: [...(doc.historique || []), ...evts],
    modifieLe: new Date().toISOString(),
  });
  await local.enregistrerDocumentLocal(doc);
  return normaliserDocument(doc);
}

/** Génération du document final (§3.5). */
export async function genererDocument(docId, format) {
  if (await estServeur()) {
    const { data } = await client.post(`/documents/${docId}/generate`, { format }, cfg({ timeout: 300000 }));
    return normaliserDocument(data.document || data);
  }
  if (format !== 'pdf') {
    throw new Error("L'export Word n'est pas disponible dans le navigateur. Exportez en PDF.");
  }
  const doc = await local.obtenirDocumentLocal(docId);
  const original = await local.obtenirFichierLocal(docId, 'original');
  try {
    const { genererPdfAvecQr } = await import('./generationPdf');
    const octets = await genererPdfAvecQr(original, doc.qrcodes);
    await local.enregistrerFichierLocal(docId, 'genere', octets);
    const maintenant = new Date().toISOString();
    Object.assign(doc, {
      statut: 'genere',
      nomGenere: nomFichierGenere(doc, 'pdf'),
      formatGenere: 'pdf',
      genereLe: maintenant,
    });
    doc.historique = [...(doc.historique || []), evenement('generation', `Génération du document PDF (${doc.qrcodes.length} QR code(s))`, { format: 'pdf', nb_qr: doc.qrcodes.length })];
    await local.enregistrerDocumentLocal(doc);
    return normaliserDocument(doc);
  } catch (err) {
    // Une génération échouée ne produit jamais de document présenté comme valide (§7.3).
    doc.historique = [...(doc.historique || []), evenement('generation', `Échec de la génération : ${err.message}`, { format: 'pdf', echec: true })];
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

function nomDepuisEntete(entete) {
  if (!entete) return null;
  const etoile = /filename\*=UTF-8''([^;]+)/i.exec(entete);
  if (etoile) return decodeURIComponent(etoile[1]);
  const simple = /filename="?([^";]+)"?/i.exec(entete);
  return simple ? simple[1] : null;
}

const MIME = Object.fromEntries(Object.entries(FORMATS).map(([cle, f]) => [cle, f.mime]));

/** Téléchargement (§3.6) : version « original » ou « genere ». */
export async function telechargerDocument(doc, version = 'genere') {
  if (await estServeur()) {
    const { data, headers } = await client.get(`/documents/${doc.id}/export?version=${version}`, cfg({ responseType: 'blob', timeout: 120000 }));
    const nom = nomDepuisEntete(headers['content-disposition'])
      || (version === 'original' ? doc.nom : doc.nomGenere || nomFichierGenere(doc, doc.formatGenere || doc.format));
    return declencherTelechargement(data, nom);
  }
  // L'original d'un document converti est le fichier Word / ODT importé (« source »).
  const converti = version === 'original' && doc.sourceFormat && doc.sourceFormat !== doc.format;
  const octets = await local.obtenirFichierLocal(doc.id, converti ? 'source' : version);
  if (!octets) throw new Error(version === 'original' ? 'Fichier original introuvable.' : "Aucun document généré : lancez d'abord la génération.");
  const format = version === 'original' ? (doc.sourceFormat || doc.format) : (doc.formatGenere || 'pdf');
  const fichier = declencherTelechargement(new Blob([octets], { type: MIME[format] }), version === 'original' ? doc.nom : doc.nomGenere);
  if (version === 'genere') {
    await journaliserLocal(doc.id, evenement('export', `Exportation du document ${doc.nomGenere}`, { format }));
  }
  return fichier;
}

/**
 * Télécharge le document avec ses QR codes, en (re)générant le PDF si nécessaire
 * (jamais généré, ou modifié depuis la dernière génération).
 * Renvoie { doc, fichier } : document à jour et fichier téléchargé.
 */
/**
 * PDF avec QR codes à imprimer : (re)généré si nécessaire, renvoyé sans téléchargement.
 * Renvoie { doc, octets }.
 */
export async function obtenirPdfAvecQr(doc) {
  if (!doc.nbQr && !doc.qrcodes?.length) throw new Error("Ajoutez d'abord un QR code.");
  const aJour = doc.genere && doc.statut === 'genere' && (doc.formatGenere || 'pdf') === 'pdf';
  const genere = aJour ? doc : await genererDocument(doc.id, 'pdf');
  if (await estServeur()) {
    const { data } = await client.get(`/documents/${doc.id}/export?version=genere`, cfg({ responseType: 'arraybuffer', timeout: 120000 }));
    return { doc: genere, octets: data };
  }
  const octets = await local.obtenirFichierLocal(doc.id, 'genere');
  if (!octets) throw new Error("Le document avec QR codes n'a pas pu être préparé.");
  await journaliserLocal(doc.id, evenement('impression', `Impression du document ${genere.nomGenere || ''}`.trim(), {}));
  return { doc: genere, octets };
}

export async function telechargerAvecQr(doc, format = 'pdf') {
  if (!doc.nbQr && !doc.qrcodes?.length) throw new Error("Ce document n'a aucun QR code : ouvrez-le pour en ajouter.");
  const aJour = doc.genere && doc.statut === 'genere' && (doc.formatGenere || 'pdf') === format;
  const genere = aJour ? doc : await genererDocument(doc.id, format);
  const fichier = await telechargerDocument(genere, 'genere');
  return { doc: genere, fichier };
}

export async function obtenirHistorique(id) {
  if (await estServeur()) {
    const { data } = await client.get(`/documents/${id}/history`, cfg());
    return (data.historique || data.history || data || []).map(e => ({
      id: e.id,
      action: e.action,
      description: e.description || e.details?.description || e.action,
      details: e.details || {},
      utilisateur: e.user_name || e.utilisateur || e.user_id || '—',
      date: e.created_at || e.date,
    }));
  }
  const doc = await local.obtenirDocumentLocal(id);
  return [...(doc?.historique || [])].reverse();
}

export async function supprimerDocument(id) {
  if (await estServeur()) {
    await client.delete(`/documents/${id}`, cfg());
    return;
  }
  await local.supprimerDocumentLocal(id);
  local.effacerBrouillon(id);
}
