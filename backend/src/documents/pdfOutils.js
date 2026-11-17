/**
 * Outils PDF : dimensions des pages, destinations nommées, moteur de génération PDF
 * (cahier des charges §3.5 A) et conversions de coordonnées (§3.4).
 *
 * Repère de l'éditeur : points PDF, origine en haut à gauche de la page affichée
 * (rotation appliquée), axe Y vers le bas — identique au frontend.
 */
const { PDFDocument, PDFName, PDFArray, PDFDict, PDFString, PDFHexString, PDFRef, StandardFonts, rgb, degrees } = require('pdf-lib');

const EMU_PAR_POINT = 12700;
const POINTS_PAR_MM = 72 / 25.4;
const TAILLE_QR_MIN = 15 * POINTS_PAR_MM;

class ErreurPdf extends Error {}

const normaliserRotation = a => (((Math.round(a || 0) % 360) + 360) % 360);

function boiteEtRotation(page) {
  const cb = page.getCropBox();
  const rotation = normaliserRotation(page.getRotation().angle);
  const boite = { x: cb.x, y: cb.y, largeur: cb.width, hauteur: cb.height };
  const affichee = (rotation === 90 || rotation === 270)
    ? { largeur: cb.height, hauteur: cb.width }
    : { largeur: cb.width, hauteur: cb.height };
  return { boite, rotation, affichee };
}

function pointAfficheVersPdf(dx, dy, boite, rotation) {
  const { x: x0, y: y0, largeur: W, hauteur: H } = boite;
  switch (normaliserRotation(rotation)) {
    case 90:  return { x: x0 + dy,     y: y0 + dx };
    case 180: return { x: x0 + W - dx, y: y0 + dy };
    case 270: return { x: x0 + W - dy, y: y0 + H - dx };
    default:  return { x: x0 + dx,     y: y0 + H - dy };
  }
}

function rectangleAfficheVersPdf(r, boite, rotation) {
  const a = pointAfficheVersPdf(r.x, r.y, boite, rotation);
  const b = pointAfficheVersPdf(r.x + r.largeur, r.y + r.hauteur, boite, rotation);
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), largeur: Math.abs(b.x - a.x), hauteur: Math.abs(b.y - a.y) };
}

const pointsVersEmu = pt => Math.round(pt * EMU_PAR_POINT);

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
    const { affichee, rotation } = boiteEtRotation(p);
    return { numero: i + 1, largeur: round(affichee.largeur), hauteur: round(affichee.hauteur), rotation };
  });
  if (!pages.length) throw new ErreurPdf('Le PDF ne contient aucune page.');
  return pages;
}

/* ---------- Destinations nommées (repérage des paragraphes DOCX) ---------- */

function texteNom(obj) {
  if (obj instanceof PDFString || obj instanceof PDFHexString) return obj.decodeText();
  if (obj instanceof PDFName) return obj.decodeText();
  return null;
}

/**
 * Lit les destinations nommées d'un PDF → Map(nom → { page (1..n), y (points, depuis le haut) }).
 * Gère l'arbre /Names /Dests et l'ancien dictionnaire /Dests du catalogue.
 */
async function lireDestinations(octets) {
  const pdf = await PDFDocument.load(octets, { updateMetadata: false });
  const ctx = pdf.context;
  const pages = pdf.getPages();
  const indexPage = new Map(pages.map((p, i) => [p.ref.toString(), i]));
  const resultat = new Map();
  const res = o => (o instanceof PDFRef ? ctx.lookup(o) : o);

  function enregistrer(nom, valeur) {
    let v = res(valeur);
    if (v instanceof PDFDict) v = res(v.get(PDFName.of('D')));
    if (!(v instanceof PDFArray) || !nom) return;
    const refPage = v.get(0);
    const i = refPage instanceof PDFRef ? indexPage.get(refPage.toString()) : undefined;
    if (i === undefined) return;
    const type = v.get(1)?.toString();
    let haut = null;
    if (type === '/XYZ' || type === '/FitH' || type === '/FitBH') {
      const t = res(v.get(type === '/XYZ' ? 3 : 2));
      haut = typeof t?.asNumber === 'function' ? t.asNumber() : null;
    }
    const { boite, rotation } = boiteEtRotation(pages[i]);
    const y = haut !== null && rotation === 0 ? round(boite.y + boite.hauteur - haut) : null;
    resultat.set(nom, { page: i + 1, y });
  }

  function parcourirArbre(noeud, profondeur = 0) {
    const n = res(noeud);
    if (!(n instanceof PDFDict) || profondeur > 32) return;
    const noms = res(n.get(PDFName.of('Names')));
    if (noms instanceof PDFArray) {
      for (let k = 0; k + 1 < noms.size(); k += 2) enregistrer(texteNom(res(noms.get(k))), noms.get(k + 1));
    }
    const enfants = res(n.get(PDFName.of('Kids')));
    if (enfants instanceof PDFArray) {
      for (let k = 0; k < enfants.size(); k++) parcourirArbre(enfants.get(k), profondeur + 1);
    }
  }

  const catalogue = pdf.catalog;
  const names = res(catalogue.get(PDFName.of('Names')));
  if (names instanceof PDFDict) parcourirArbre(names.get(PDFName.of('Dests')));
  const dests = res(catalogue.get(PDFName.of('Dests')));
  if (dests instanceof PDFDict) {
    for (const [cle, valeur] of dests.entries()) enregistrer(cle.decodeText(), valeur);
  }
  return resultat;
}

/* ---------- Validation des positions ---------- */

/**
 * Vérifie qu'une position est cohérente avec la page (§8 « position hors page »).
 * Renvoie un message d'erreur ou null.
 */
function verifierPosition(pos, pages) {
  const page = pages[pos.page_number - 1];
  if (!page) return `La page ${pos.page_number} n'existe pas (le document compte ${pages.length} page(s)).`;
  const { position_x: x, position_y: y, width: w, height: h } = pos;
  if (![x, y, w, h].every(Number.isFinite)) return 'Position ou dimensions invalides.';
  if (w < TAILLE_QR_MIN - 0.5 || h < TAILLE_QR_MIN - 0.5) return 'Le QR code doit mesurer au moins 15 mm pour rester lisible après impression.';
  if (Math.abs(w - h) > 0.5) return 'Le QR code doit rester carré (proportions conservées).';
  const eps = 0.5;
  if (x < -eps || y < -eps || x + w > page.largeur + eps || y + h > page.hauteur + eps) {
    return `Le QR code dépasse les limites de la page ${pos.page_number}.`;
  }
  return null;
}

/* ---------- Moteur de génération PDF ---------- */

/**
 * @param {Buffer} octetsOriginal
 * @param {Array} qrcodes [{ reference, png, page, x, y, largeur, hauteur }]
 */
/* ---------- Étiquette : nom du QR code écrit en clair au-dessus du QR ---------- */

/** Part du cadre (carré) réservée à la bande du nom, en haut. Identique dans l'éditeur. */
const PROPORTION_BANDE_NOM = 0.18;

/**
 * Découpe du cadre d'un QR code : bande du nom en haut, QR code carré centré dessous.
 * Coordonnées dans le repère affiché (haut-gauche, Y vers le bas).
 */
function dispositionEtiquette(qr) {
  const bande = qr.hauteur * PROPORTION_BANDE_NOM;
  const cote = Math.min(qr.largeur, qr.hauteur - bande);
  return {
    bande: { x: qr.x, y: qr.y, largeur: qr.largeur, hauteur: bande },
    qr: { x: qr.x + (qr.largeur - cote) / 2, y: qr.y + bande, largeur: cote, hauteur: cote },
  };
}

/** Écrit le nom centré dans la bande, en tenant compte de la rotation de la page. */
function dessinerNom(page, police, nom, bande, boite, rotation) {
  let taille = bande.hauteur * 0.62;
  const largeurMax = bande.largeur * 0.94;
  const largeurTexte = police.widthOfTextAtSize(nom, taille);
  if (largeurTexte > largeurMax) taille *= largeurMax / largeurTexte;
  const largeur = police.widthOfTextAtSize(nom, taille);
  // Ligne de base, dans le repère affiché, puis conversion vers l'espace de la page.
  const dx = bande.x + (bande.largeur - largeur) / 2;
  const dy = bande.y + bande.hauteur / 2 + taille * 0.35;
  const origine = pointAfficheVersPdf(dx, dy, boite, rotation);
  page.drawText(nom, { x: origine.x, y: origine.y, size: taille, font: police, color: rgb(0, 0, 0), rotate: degrees(rotation) });
}

async function genererPdfAvecQr(octetsOriginal, qrcodes) {
  const pdf = await chargerPdf(octetsOriginal);
  const nbPages = pdf.getPageCount();
  const images = new Map();
  const police = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const qr of qrcodes) {
    if (qr.page < 1 || qr.page > nbPages) throw new ErreurPdf(`Le QR code ${qr.reference} est placé sur une page inexistante.`);
    const page = pdf.getPage(qr.page - 1);
    const { boite, rotation, affichee } = boiteEtRotation(page);
    const erreur = verifierPosition({ page_number: 1, position_x: qr.x, position_y: qr.y, width: qr.largeur, height: qr.hauteur }, [affichee]);
    if (erreur) throw new ErreurPdf(`QR code ${qr.reference} : ${erreur}`);

    const cle = qr.png.toString('base64');
    if (!images.has(cle)) images.set(cle, await pdf.embedPng(qr.png));
    const zones = dispositionEtiquette(qr);

    // Fond blanc sous l'ensemble (lisibilité du nom et du QR code sur le document).
    const fond = rectangleAfficheVersPdf({ x: qr.x, y: qr.y, largeur: qr.largeur, hauteur: qr.hauteur }, boite, rotation);
    page.drawRectangle({ x: fond.x, y: fond.y, width: fond.largeur, height: fond.hauteur, color: rgb(1, 1, 1) });

    // Nom du QR code en clair, au-dessus.
    if (qr.nom) dessinerNom(page, police, qr.nom, zones.bande, boite, rotation);

    // QR code : carré, lisible quelle que soit l'orientation (pas de rotation de l'image).
    const r = rectangleAfficheVersPdf(zones.qr, boite, rotation);
    page.drawImage(images.get(cle), { x: r.x, y: r.y, width: r.largeur, height: r.hauteur });
  }

  const sortie = Buffer.from(await pdf.save());
  // Contrôle : le document produit doit être relisible et complet (§7.3).
  const controle = await PDFDocument.load(sortie);
  if (controle.getPageCount() !== nbPages) throw new ErreurPdf('Le document généré est incohérent (nombre de pages différent).');
  return sortie;
}

function round(v) {
  return Math.round(v * 100) / 100;
}

module.exports = {
  PROPORTION_BANDE_NOM,
  dispositionEtiquette,
  ErreurPdf,
  EMU_PAR_POINT,
  POINTS_PAR_MM,
  TAILLE_QR_MIN,
  pointsVersEmu,
  pointAfficheVersPdf,
  rectangleAfficheVersPdf,
  infosPages,
  lireDestinations,
  verifierPosition,
  genererPdfAvecQr,
  chargerPdf,
};
