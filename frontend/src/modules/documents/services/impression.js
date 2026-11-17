import { PDFDocument } from 'pdf-lib';
import { chargerPdf, rendrePage } from './pdfRendu';

/**
 * Impression du document avec ses QR codes.
 *
 * Une page web ne peut pas rechercher elle-même une imprimante (Wi-Fi, Bluetooth…) :
 * c'est la fenêtre d'impression du système qui propose les imprimantes disponibles
 * autour de l'appareil (AirPrint sur iPhone/iPad, service d'impression Mopria/Wi-Fi
 * Direct sur Android, imprimantes installées ou réseau sur Windows/Mac).
 *
 * - Chrome / Edge sur ordinateur : le PDF est confié au lecteur PDF intégré du
 *   navigateur (iframe invisible) qui l'imprime : aperçu exact, impression vectorielle.
 * - Autres cas (mobiles, Firefox, Safari) : chaque page est rendue en image haute
 *   définition (≈ 200 ppp), incorporée au document d'impression (data URL).
 */

const ID_IFRAME = 'tq-iframe-impression';
const ID_ZONE = 'tq-zone-impression';
const ID_STYLE = 'tq-style-impression';
const PIXELS_PAR_POINT = 2.8; // ≈ 200 ppp

const ua = () => navigator.userAgent || '';
const estIOS = () => /iPad|iPhone|iPod/.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const estMobile = () => estIOS() || /Android|Mobile/i.test(ua());
/** Chrome, Edge, Opera… sur ordinateur : lecteur PDF intégré capable d'imprimer. */
const lecteurPdfIntegre = () => !estMobile() && /Chrome|Chromium|Edg\//.test(ua()) && !/Electron/.test(ua());

function nettoyer() {
  document.getElementById(ID_IFRAME)?.remove();
  document.getElementById(ID_ZONE)?.remove();
  document.getElementById(ID_STYLE)?.remove();
}

/** Ouvre la fenêtre d'impression de `fenetre` et attend sa fermeture (ou 1 s). */
function lancerImpression(fenetre) {
  return new Promise(resolve => {
    let fini = false;
    const terminer = () => { if (!fini) { fini = true; resolve(); } };
    try { fenetre.addEventListener('afterprint', terminer, { once: true }); } catch { /* lecteur PDF */ }
    fenetre.focus();
    fenetre.print(); // bloquant sur ordinateur ; asynchrone sur certains mobiles
    setTimeout(terminer, 1000);
  });
}

/* ---------- 1. Lecteur PDF intégré (Chrome / Edge sur ordinateur) ---------- */

async function imprimerPdfNatif(octets, titre) {
  // Titre du PDF : nom proposé pour « Enregistrer en PDF » et nom de la tâche d'impression.
  let donnees = octets;
  if (titre) {
    const pdf = await PDFDocument.load(octets, { updateMetadata: false });
    pdf.setTitle(titre, { showInWindowTitleBar: true });
    donnees = await pdf.save();
  }
  const url = URL.createObjectURL(new Blob([donnees], { type: 'application/pdf' }));
  const iframe = document.createElement('iframe');
  iframe.id = ID_IFRAME;
  iframe.title = 'Impression';
  iframe.setAttribute('aria-hidden', 'true');
  // Rendue mais invisible : le lecteur PDF ne se charge pas dans une iframe en display:none.
  Object.assign(iframe.style, {
    position: 'fixed', right: '0', bottom: '0', width: '1px', height: '1px', border: '0', visibility: 'hidden',
  });
  const charge = new Promise((resolve, reject) => {
    iframe.onload = resolve;
    iframe.onerror = () => reject(new Error("Le document n'a pas pu être préparé pour l'impression."));
  });
  iframe.src = url;
  document.body.appendChild(iframe);
  await charge;
  // Laisse au lecteur PDF le temps d'afficher le document avant d'imprimer.
  await new Promise(r => setTimeout(r, 1000));
  await lancerImpression(iframe.contentWindow);
  return url;
}

/* ---------- 2. Pages en images (mobiles, Firefox, Safari) ---------- */

async function pagesEnImages(octets, onProgression) {
  const { pdf, pages } = await chargerPdf(octets);
  try {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const images = [];
    for (const page of pages) {
      onProgression?.(page.numero, pages.length);
      const canvas = await rendrePage(pdf, page.numero, PIXELS_PAR_POINT / ratio).promesse;
      if (!canvas) throw new Error('Rendu de la page impossible.');
      // Image incorporée (data URL) : toujours reprise par l'aperçu d'impression.
      images.push(canvas.toDataURL('image/png'));
    }
    return { images, page: pages[0] };
  } finally {
    pdf.destroy();
  }
}

async function imagePrete(img) {
  if (!img.complete) await new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
  if (img.decode) await img.decode().catch(() => {});
}

function stylePages(page, prefixe = '') {
  return `
    @page { size: ${page.largeur}pt ${page.hauteur}pt; margin: 0; }
    html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
    ${prefixe}img { display: block; width: 100%; height: auto; page-break-after: always; break-after: page; }
    ${prefixe}img:last-child { page-break-after: auto; break-after: auto; }`;
}

function echapper(t) {
  return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** Document d'impression séparé (iframe) contenant uniquement les pages (Firefox, Android…). */
async function imprimerImagesDansIframe(images, page, titre) {
  const iframe = document.createElement('iframe');
  iframe.id = ID_IFRAME;
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '1px', height: '1px', border: '0', visibility: 'hidden' });
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${echapper(titre || 'Document')}</title>`
    + `<style>${stylePages(page)}</style></head><body>`
    + images.map((u, i) => `<img src="${u}" alt="Page ${i + 1}">`).join('')
    + '</body></html>');
  doc.close();
  await Promise.all([...doc.images].map(imagePrete));
  await lancerImpression(iframe.contentWindow);
}

/** Impression depuis la page elle-même, interface masquée (iPhone / iPad). */
async function imprimerImagesDansPage(images, page) {
  const zone = document.createElement('div');
  zone.id = ID_ZONE;
  images.forEach((u, i) => {
    const img = document.createElement('img');
    img.src = u;
    img.alt = `Page ${i + 1}`;
    zone.appendChild(img);
  });
  const style = document.createElement('style');
  style.id = ID_STYLE;
  style.textContent = `
    #${ID_ZONE} { display: none; }
    @media print {
      ${stylePages(page, `#${ID_ZONE} `)}
      body > *:not(#${ID_ZONE}) { display: none !important; }
      body::before, body::after { display: none !important; }
      #${ID_ZONE} { display: block !important; }
    }`;
  document.head.appendChild(style);
  document.body.appendChild(zone);
  await Promise.all([...zone.querySelectorAll('img')].map(imagePrete));
  await lancerImpression(window);
}

/**
 * @param {ArrayBuffer} octets PDF à imprimer
 * @param {(n: number, total: number) => void} [onProgression]
 * @param {string} [titre] nom de l'impression (nom des QR codes) : nom de la tâche
 *   d'impression et nom de fichier proposé par « Enregistrer en PDF ».
 */
export async function imprimerPdf(octets, onProgression, titre) {
  nettoyer();
  const titreInitial = document.title;
  let url = null;
  try {
    if (titre) document.title = titre;
    if (lecteurPdfIntegre()) {
      url = await imprimerPdfNatif(octets, titre);
    } else {
      const { images, page } = await pagesEnImages(octets, onProgression);
      if (estIOS()) await imprimerImagesDansPage(images, page);
      else await imprimerImagesDansIframe(images, page, titre);
    }
  } finally {
    document.title = titreInitial;
    // Laisse le temps à la fenêtre d'impression (et aux navigateurs mobiles) de finir.
    setTimeout(() => {
      nettoyer();
      if (url) URL.revokeObjectURL(url);
    }, 60000);
  }
}
