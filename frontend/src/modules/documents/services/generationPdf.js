import { PDFDocument } from 'pdf-lib';
import { normaliserRotation, rectangleAfficheVersPdf, estHorsPage } from '../utils/coordonnees';
import { qrPngOctets } from '../utils/qr';

/**
 * PDFGenerationService — cahier des charges §3.5 A
 * Charge l'original, intègre les QR codes aux pages concernées et produit un NOUVEAU PDF.
 * L'original n'est jamais modifié (on travaille sur une copie des octets).
 */
export async function genererPdfAvecQr(octetsOriginal, qrcodes) {
  if (!qrcodes.length) throw new Error('Aucun QR code à intégrer.');

  let pdf;
  try {
    pdf = await PDFDocument.load(octetsOriginal.slice(0), { updateMetadata: false });
  } catch (err) {
    if (/encrypt/i.test(err?.message || '')) {
      throw new Error('Ce PDF est chiffré : il ne peut pas être modifié sans être déverrouillé au préalable.', { cause: err });
    }
    throw new Error("Le PDF original n'a pas pu être chargé pour la génération.", { cause: err });
  }

  const nbPages = pdf.getPageCount();
  const images = new Map();

  for (const qr of qrcodes) {
    if (!qr.contenu) throw new Error(`Le QR code ${qr.reference || ''} est invalide (contenu vide).`);
    if (qr.page < 1 || qr.page > nbPages) throw new Error(`Le QR code ${qr.reference} est placé sur une page inexistante (${qr.page}).`);

    const page = pdf.getPage(qr.page - 1);
    const rotation = normaliserRotation(page.getRotation().angle);
    const cb = page.getCropBox();
    const boite = { x: cb.x, y: cb.y, largeur: cb.width, hauteur: cb.height };
    const affichee = (rotation === 90 || rotation === 270)
      ? { largeur: cb.height, hauteur: cb.width }
      : { largeur: cb.width, hauteur: cb.height };

    if (estHorsPage(qr, affichee)) {
      throw new Error(`Le QR code ${qr.reference} dépasse les limites de la page ${qr.page}.`);
    }

    if (!images.has(qr.contenu)) {
      images.set(qr.contenu, await pdf.embedPng(await qrPngOctets(qr.contenu)));
    }

    // Un QR code est carré et lisible quelle que soit son orientation :
    // on le dessine directement dans le rectangle converti, sans rotation de l'image.
    const r = rectangleAfficheVersPdf({ x: qr.x, y: qr.y, largeur: qr.largeur, hauteur: qr.hauteur }, boite, rotation);
    page.drawImage(images.get(qr.contenu), { x: r.x, y: r.y, width: r.largeur, height: r.hauteur });
  }

  const octets = await pdf.save();

  // Contrôle : le document généré doit être relisible et complet (§7.3).
  const controle = await PDFDocument.load(octets);
  if (controle.getPageCount() !== nbPages) {
    throw new Error('Le document généré est incohérent (nombre de pages différent). Génération annulée.');
  }
  return octets;
}
