import { useEffect, useRef, useState } from 'react';
import { MOTIF_NOM_QR, normaliserNomQr, suggererNomQr } from '../services/documentsApi';

/**
 * Saisie du nom d'un QR code (ajout, duplication, renommage).
 * Le nom est le numéro de parapheur encodé dans le QR code : il doit être unique,
 * ce que le serveur vérifie au moment de la validation.
 */
export default function DialogueNomQr({ titre, libelleValider, valeurInitiale = '', proposerSuggestion = true, onValider, onFermer }) {
  const [nom, setNom] = useState(valeurInitiale);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const champRef = useRef(null);

  // Suggestion d'un nom libre (DEP-…) si aucun nom n'est déjà saisi.
  useEffect(() => {
    let actif = true;
    if (proposerSuggestion && !valeurInitiale) {
      suggererNomQr().then(s => { if (actif && s) setNom(n => n || s); });
    }
    champRef.current?.focus();
    return () => { actif = false; };
  }, [proposerSuggestion, valeurInitiale]);

  useEffect(() => {
    function echap(e) { if (e.key === 'Escape' && !envoi) onFermer(); }
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [envoi, onFermer]);

  const normalise = normaliserNomQr(nom);
  const formatInvalide = normalise !== '' && !MOTIF_NOM_QR.test(normalise);

  async function valider(e) {
    e.preventDefault();
    if (!normalise) { setErreur('Donnez un nom au QR code.'); return; }
    if (formatInvalide) return;
    setEnvoi(true);
    setErreur('');
    try {
      await onValider(normalise);
    } catch (err) {
      // Nom déjà utilisé ou autre refus du serveur : la fenêtre reste ouverte.
      setErreur(err.message || 'Opération impossible.');
      setEnvoi(false);
      champRef.current?.select();
    }
  }

  return (
    <div className="modale-fond" onClick={() => !envoi && onFermer()}>
      <form className="carte modale" role="dialog" aria-modal="true" aria-labelledby="titre-nom-qr" onClick={e => e.stopPropagation()} onSubmit={valider}>
        <h2 id="titre-nom-qr" style={{ fontSize: 18, fontWeight: 700 }}>{titre}</h2>
        <div>
          <label className="label-champ" htmlFor="nom-qr">Nom du QR code (numéro du parapheur)</label>
          <input
            id="nom-qr"
            ref={champRef}
            className="champ"
            value={nom}
            maxLength={50}
            autoComplete="off"
            spellCheck={false}
            style={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}
            onChange={e => { setNom(e.target.value); setErreur(''); }}
            disabled={envoi}
            aria-invalid={formatInvalide || Boolean(erreur)}
          />
          <p style={{ fontSize: 11, color: formatInvalide ? 'var(--rouge)' : 'var(--texte3)', marginTop: 6 }}>
            {formatInvalide
              ? 'Lettres, chiffres et tirets uniquement (50 caractères maximum).'
              : 'Ce nom est unique : deux QR codes ne peuvent pas porter le même nom.'}
          </p>
        </div>
        {erreur && <div className="message-erreur" role="alert">{erreur}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn" onClick={onFermer} disabled={envoi}>Annuler</button>
          <button type="submit" className="btn btn-primaire" disabled={envoi || !normalise || formatInvalide}>
            {envoi ? 'Vérification…' : libelleValider}
          </button>
        </div>
      </form>
    </div>
  );
}
