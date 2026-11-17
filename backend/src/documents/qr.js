/**
 * Génération des QR codes (cahier des charges §3.3).
 */
const crypto = require('crypto');
const QRCode = require('qrcode');

// Marge de 2 modules + correction « M » : lisibilité après impression/numérisation (§7.3).
const OPTIONS = { errorCorrectionLevel: 'M', margin: 2, width: 768, color: { dark: '#000000', light: '#FFFFFF' } };

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I

/** Jeton de référence non prédictible (≈ 80 bits d'entropie), ex. TQ-7KQ2M9XHD4PA3WZ6. */
function genererJeton() {
  const octets = crypto.randomBytes(16);
  let s = '';
  for (let i = 0; i < 16; i++) s += ALPHABET[octets[i] % ALPHABET.length];
  return `TQ-${s}`;
}

const MOTIF_JETON = /^TQ-[A-HJ-NP-Z2-9]{16}$/;

async function pngQr(contenu) {
  if (!contenu || typeof contenu !== 'string') throw new Error('QR code invalide : contenu vide.');
  return QRCode.toBuffer(contenu, { ...OPTIONS, type: 'png' });
}

module.exports = { genererJeton, pngQr, MOTIF_JETON };
