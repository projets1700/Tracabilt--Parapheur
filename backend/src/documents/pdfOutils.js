/**
 * Outils PDF (serveur) : lecture et contrôle d'un PDF (fichier importé ou issu
 * d'une conversion). La génération des PDF avec QR codes se fait dans le navigateur.
 */
const { PDFDocument } = require('pdf-lib');

class ErreurPdf extends Error {}

const normaliserRotation = a => (((Math.round(a || 0) % 360) + 360) % 360);

async function chargerPdf(octets) {
  try {
    return await PDFDocument.load(octets, { updateMetadata: false });
  } catch (err) {
    if (/encrypt/i.test(err?.message || '')) {
      throw new ErreurPdf('Ce PDF est chiffré ou protégé : il ne peut pas être modifié.', { cause: err });
    }
    throw new ErreurPdf('Le PDF est corrompu ou illisible.', { cause: err });
  }
}

/** Dimensions affichées de chaque page (points). */
async function infosPages(octets) {
  const pdf = await chargerPdf(octets);
  const pages = pdf.getPages().map((p, i) => {
    const cb = p.getCropBox();
    const rotation = normaliserRotation(p.getRotation().angle);
    const tournee = rotation === 90 || rotation === 270;
    return { numero: i + 1, largeur: tournee ? cb.height : cb.width, hauteur: tournee ? cb.width : cb.height, rotation };
  });
  if (!pages.length) throw new ErreurPdf('Le PDF ne contient aucune page.');
  return pages;
}

module.exports = { ErreurPdf, chargerPdf, infosPages };
