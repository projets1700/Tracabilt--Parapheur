/**
 * Stockage local (IndexedDB) utilisé tant que le serveur documentaire
 * (routes /api/documents) n'est pas déployé. Les documents restent dans
 * le navigateur de l'utilisateur.
 */

const NOM_BASE = 'tracaparapheur-documents';
const VERSION = 1;

let basePromesse = null;

function ouvrir() {
  if (!basePromesse) {
    basePromesse = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("Le stockage local n'est pas disponible dans ce navigateur."));
        return;
      }
      const req = indexedDB.open(NOM_BASE, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('documents')) db.createObjectStore('documents', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('fichiers'))  db.createObjectStore('fichiers');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Ouverture du stockage local impossible.'));
    }).catch(err => {
      basePromesse = null;
      throw err;
    });
  }
  return basePromesse;
}

async function transaction(stores, mode, action) {
  const db = await ouvrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let resultat;
    Promise.resolve(action(tx)).then(r => { resultat = r; }, reject);
    tx.oncomplete = () => resolve(resultat);
    tx.onerror = () => reject(tx.error || new Error('Erreur de stockage local.'));
    tx.onabort = () => reject(tx.error || new Error('Erreur de stockage local (quota dépassé ?).'));
  });
}

function requete(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function listerDocumentsLocaux() {
  return transaction(['documents'], 'readonly', tx => requete(tx.objectStore('documents').getAll()));
}

export function obtenirDocumentLocal(id) {
  return transaction(['documents'], 'readonly', tx => requete(tx.objectStore('documents').get(id)));
}

export function enregistrerDocumentLocal(doc) {
  return transaction(['documents'], 'readwrite', tx => requete(tx.objectStore('documents').put(doc)));
}

export function obtenirFichierLocal(id, version) {
  return transaction(['fichiers'], 'readonly', tx => requete(tx.objectStore('fichiers').get(`${id}:${version}`)));
}

export function enregistrerFichierLocal(id, version, octets) {
  return transaction(['fichiers'], 'readwrite', tx => requete(tx.objectStore('fichiers').put(octets, `${id}:${version}`)));
}

export function supprimerDocumentLocal(id) {
  return transaction(['documents', 'fichiers'], 'readwrite', tx => {
    tx.objectStore('documents').delete(id);
    tx.objectStore('fichiers').delete(`${id}:original`);
    tx.objectStore('fichiers').delete(`${id}:genere`);
    tx.objectStore('fichiers').delete(`${id}:source`);
  });
}

/* ---------- Brouillons (préservation du travail en cas de perte de connexion, §8) ---------- */

const PREFIXE_BROUILLON = 'doc_brouillon_';

export function lireBrouillon(id) {
  try {
    return JSON.parse(localStorage.getItem(PREFIXE_BROUILLON + id) || 'null');
  } catch {
    return null;
  }
}

export function ecrireBrouillon(id, brouillon) {
  try {
    localStorage.setItem(PREFIXE_BROUILLON + id, JSON.stringify({ ...brouillon, enregistreLe: new Date().toISOString() }));
  } catch {
    // quota dépassé ou stockage bloqué : le brouillon est une commodité, on ignore.
  }
}

export function effacerBrouillon(id) {
  try {
    localStorage.removeItem(PREFIXE_BROUILLON + id);
  } catch {
    // ignoré
  }
}
