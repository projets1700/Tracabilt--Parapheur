import QRCode from 'qrcode';

/**
 * Génération des images de QR code.
 * Marge de 2 modules (zone de silence) et correction d'erreur « M » :
 * bon compromis lisibilité / densité après impression et numérisation (§7.3).
 */
const OPTIONS = { errorCorrectionLevel: 'M', margin: 2, width: 768, color: { dark: '#000000', light: '#FFFFFF' } };

const cacheDataUrl = new Map();
const cacheImage = new Map();

export function qrDataUrl(contenu) {
  if (!contenu) return Promise.reject(new Error('QR code invalide : contenu vide.'));
  if (!cacheDataUrl.has(contenu)) {
    cacheDataUrl.set(contenu, QRCode.toDataURL(contenu, OPTIONS).catch(err => {
      cacheDataUrl.delete(contenu);
      throw err;
    }));
  }
  return cacheDataUrl.get(contenu);
}

export async function qrPngOctets(contenu) {
  const url = await qrDataUrl(contenu);
  const b64 = url.slice(url.indexOf(',') + 1);
  const bin = atob(b64);
  const octets = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
  return octets;
}

export function qrImage(contenu) {
  if (!cacheImage.has(contenu)) {
    cacheImage.set(contenu, qrDataUrl(contenu).then(url => new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Impossible de générer le QR code.'));
      img.src = url;
    })).catch(err => {
      cacheImage.delete(contenu);
      throw err;
    }));
  }
  return cacheImage.get(contenu);
}

const cacheEtiquette = new Map();

/**
 * Image de l'éditeur : nom du QR code en clair au-dessus du QR code, sur fond blanc,
 * avec la même disposition que dans le PDF généré (bande de 18 %).
 */
export function etiquetteImage(contenu, nom, proportionBande = 0.18) {
  const cle = `${contenu}|${nom}`;
  if (!cacheEtiquette.has(cle)) {
    cacheEtiquette.set(cle, qrImage(contenu).then(img => {
      const T = 600;
      const bande = T * proportionBande;
      const cote = T - bande;
      const canvas = document.createElement('canvas');
      canvas.width = T;
      canvas.height = T;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, T, T);
      if (nom) {
        let taille = bande * 0.62;
        ctx.font = `bold ${taille}px Helvetica, Arial, sans-serif`;
        const largeur = ctx.measureText(nom).width;
        if (largeur > T * 0.94) taille *= (T * 0.94) / largeur;
        ctx.font = `bold ${taille}px Helvetica, Arial, sans-serif`;
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(nom, T / 2, bande / 2);
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, (T - cote) / 2, bande, cote, cote);
      return canvas;
    }).catch(err => {
      cacheEtiquette.delete(cle);
      throw err;
    }));
  }
  return cacheEtiquette.get(cle);
}

export function cleUnique() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
