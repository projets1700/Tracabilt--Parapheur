/**
 * Jetons de QR code (ancien mode « jeton ») : format reconnu lors d'un scan
 * pour retrouver le parapheur correspondant (voir scansController).
 */
const MOTIF_JETON = /^TQ-[A-HJ-NP-Z2-9]{16}$/;

module.exports = { MOTIF_JETON };
