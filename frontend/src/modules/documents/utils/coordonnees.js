/**
 * CoordinateConverter — cahier des charges §3.4 et §6.3
 *
 * Repère de référence de l'éditeur (indépendant du zoom) :
 *   - unité : point PDF (1/72 de pouce) ;
 *   - origine : coin HAUT-GAUCHE de la page TELLE QU'AFFICHÉE (rotation appliquée) ;
 *   - axe Y vers le bas.
 *
 * Les moteurs de génération convertissent ensuite vers leur propre repère :
 *   - PDF  : espace utilisateur de la page (origine bas-gauche, avant rotation) ;
 *   - Word : EMU (English Metric Units), 1 pt = 12 700 EMU.
 */

export const EMU_PAR_POINT = 12700;
export const POINTS_PAR_MM = 72 / 25.4;

export const mmVersPoints = mm => mm * POINTS_PAR_MM;
export const pointsVersMm = pt => pt / POINTS_PAR_MM;
export const pointsVersEmu = pt => Math.round(pt * EMU_PAR_POINT);

/** Taille par défaut d'un QR code : 25 mm, lisible après impression. */
export const TAILLE_QR_DEFAUT = mmVersPoints(25);
/** En dessous de 15 mm, la lecture après impression n'est plus fiable. */
export const TAILLE_QR_MIN = mmVersPoints(15);
/** Seuil d'avertissement : en dessous de 20 mm, on prévient l'utilisateur. */
export const TAILLE_QR_CONSEILLEE = mmVersPoints(20);
/** Marge utilisée pour les repères visuels et le placement par défaut. */
export const MARGE_REPERE = mmVersPoints(15);

export function normaliserRotation(angle) {
  return (((Math.round(angle || 0) % 360) + 360) % 360);
}

/**
 * Dimensions affichées d'une page à partir de sa boîte (non tournée) et de sa rotation.
 */
export function dimensionsAffichees(largeurBoite, hauteurBoite, rotation) {
  const r = normaliserRotation(rotation);
  return (r === 90 || r === 270)
    ? { largeur: hauteurBoite, hauteur: largeurBoite }
    : { largeur: largeurBoite, hauteur: hauteurBoite };
}

/**
 * Convertit un point (dx, dy) du repère affiché (haut-gauche, Y vers le bas)
 * vers l'espace utilisateur PDF de la page.
 * boite = { x, y, largeur, hauteur } : CropBox de la page, non tournée.
 */
export function pointAfficheVersPdf(dx, dy, boite, rotation) {
  const { x: x0, y: y0, largeur: W, hauteur: H } = boite;
  switch (normaliserRotation(rotation)) {
    case 90:  return { x: x0 + dy,     y: y0 + dx };
    case 180: return { x: x0 + W - dx, y: y0 + dy };
    case 270: return { x: x0 + W - dy, y: y0 + H - dx };
    default:  return { x: x0 + dx,     y: y0 + H - dy };
  }
}

/**
 * Convertit un rectangle du repère affiché vers un rectangle PDF
 * (coin bas-gauche + dimensions) prêt pour pdf-lib `drawImage`.
 */
export function rectangleAfficheVersPdf(rect, boite, rotation) {
  const a = pointAfficheVersPdf(rect.x, rect.y, boite, rotation);
  const b = pointAfficheVersPdf(rect.x + rect.largeur, rect.y + rect.hauteur, boite, rotation);
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    largeur: Math.abs(b.x - a.x),
    hauteur: Math.abs(b.y - a.y),
  };
}

/**
 * Corrige une position pour qu'elle reste entièrement dans la page
 * (cahier des charges §8 : « Position hors page → corriger ou bloquer »).
 */
export function contraindreDansPage(qr, page) {
  const taille = Math.min(Math.max(qr.largeur, TAILLE_QR_MIN), page.largeur, page.hauteur);
  return {
    ...qr,
    largeur: taille,
    hauteur: taille,
    x: Math.min(Math.max(qr.x, 0), page.largeur - taille),
    y: Math.min(Math.max(qr.y, 0), page.hauteur - taille),
  };
}

export function estHorsPage(qr, page) {
  if (!page) return true;
  const eps = 0.01;
  return qr.x < -eps || qr.y < -eps
    || qr.x + qr.largeur > page.largeur + eps
    || qr.y + qr.hauteur > page.hauteur + eps;
}

/**
 * Charge utile envoyée à l'API pour une position (§6.3) : repère physique clairement
 * défini + dimensions/rotation de la page + équivalents EMU pour le moteur Word.
 */
export function positionVersApi(qr, page) {
  return {
    page_number: qr.page,
    position_x: round(qr.x),
    position_y: round(qr.y),
    width: round(qr.largeur),
    height: round(qr.hauteur),
    unite: 'pt',
    origine: 'haut-gauche',
    page_largeur: page ? round(page.largeur) : null,
    page_hauteur: page ? round(page.hauteur) : null,
    page_rotation: page ? page.rotation : 0,
    emu: {
      x: pointsVersEmu(qr.x),
      y: pointsVersEmu(qr.y),
      cx: pointsVersEmu(qr.largeur),
      cy: pointsVersEmu(qr.hauteur),
    },
  };
}

/** Lecture tolérante d'une position renvoyée par l'API. */
export function positionDepuisApi(p) {
  return {
    page: Number(p.page_number ?? p.page ?? 1),
    x: Number(p.position_x ?? p.x ?? 0),
    y: Number(p.position_y ?? p.y ?? 0),
    largeur: Number(p.width ?? p.largeur ?? TAILLE_QR_DEFAUT),
    hauteur: Number(p.height ?? p.hauteur ?? p.width ?? TAILLE_QR_DEFAUT),
  };
}

function round(v) {
  return Math.round(v * 100) / 100;
}
