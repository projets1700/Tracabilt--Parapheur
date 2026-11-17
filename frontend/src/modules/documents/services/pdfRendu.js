import * as pdfjs from 'pdfjs-dist';
import urlWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { dimensionsAffichees, normaliserRotation } from '../utils/coordonnees';

pdfjs.GlobalWorkerOptions.workerSrc = urlWorker;

/**
 * DocumentPreviewService — chargement d'un PDF (natif ou issu de la conversion Word)
 * et extraction des dimensions de chaque page dans le repère de l'éditeur.
 */
export async function chargerPdf(octets) {
  // pdf.js transfère le buffer au worker : on lui passe une copie.
  const donnees = new Uint8Array(octets instanceof ArrayBuffer ? octets.slice(0) : octets.slice());
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: donnees, isEvalSupported: false }).promise;
  } catch (err) {
    if (err?.name === 'PasswordException') {
      throw new Error('Ce PDF est protégé par un mot de passe et ne peut pas être modifié.', { cause: err });
    }
    if (/worker/i.test(err?.message || '')) {
      throw new Error("Le moteur d'affichage PDF n'a pas pu être chargé. Rechargez la page ; si le problème persiste, contactez l'administrateur.", { cause: err });
    }
    throw new Error("Le document n'a pas pu être lu : le fichier est corrompu ou dans un format non reconnu.", { cause: err });
  }

  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const [x0, y0, x1, y1] = page.view;
    const rotation = normaliserRotation(page.rotate);
    const largeurBoite = x1 - x0;
    const hauteurBoite = y1 - y0;
    const { largeur, hauteur } = dimensionsAffichees(largeurBoite, hauteurBoite, rotation);
    pages.push({
      numero: i,
      largeur,
      hauteur,
      rotation,
      boite: { x: x0, y: y0, largeur: largeurBoite, hauteur: hauteurBoite },
    });
  }
  return { pdf, pages };
}

/**
 * Rendu d'une page dans un NOUVEAU canvas, à l'échelle demandée (pixels CSS par point).
 * La promesse renvoie le canvas une fois dessiné (ou null si le rendu a été annulé),
 * ce qui permet de l'échanger sans scintillement.
 */
export function rendrePage(pdf, numero, echelle) {
  let tache = null;
  let annule = false;
  const promesse = pdf.getPage(numero).then(page => {
    if (annule) return null;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: echelle * ratio });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    tache = page.render({ canvasContext: canvas.getContext('2d'), viewport });
    return tache.promise.then(() => (annule ? null : canvas));
  }).catch(err => {
    if (err?.name === 'RenderingCancelledException') return null;
    throw err;
  });
  return {
    promesse,
    annuler() {
      annule = true;
      tache?.cancel();
    },
  };
}
