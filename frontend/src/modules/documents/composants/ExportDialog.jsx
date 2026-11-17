import { useEffect, useState } from 'react';
import { genererDocument, telechargerDocument, messageErreur } from '../services/documentsApi';

const REGLES = {
  docx: { docx: 'Modification du document Word original.', pdf: 'Conversion du document Word modifié en PDF.' },
  pdf:  { pdf: 'Modification du PDF original.', docx: 'Reconstruction du PDF au format Word.' },
};

/**
 * ExportDialog — choix du format de sortie, génération et téléchargement (§3.5, §3.6).
 */
export default function ExportDialog({ doc, mode, nbQr, aEnregistrer, onEnregistrer, onFermer, onTermine }) {
  const local = mode?.mode === 'local';
  const [format, setFormat] = useState(local ? 'pdf' : doc.format);
  const [compris, setCompris] = useState(false);
  const [etape, setEtape] = useState('');
  const [erreur, setErreur] = useState('');
  const enCours = Boolean(etape);

  const reconstruction = doc.format === 'pdf' && format === 'docx';
  const bloquant = nbQr === 0 ? 'Ajoutez au moins un QR code avant de générer le document.' : null;

  useEffect(() => {
    function echap(e) { if (e.key === 'Escape' && !enCours) onFermer(); }
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [enCours, onFermer]);

  async function lancer() {
    setErreur('');
    try {
      if (aEnregistrer) {
        setEtape('Enregistrement des modifications…');
        await onEnregistrer();
      }
      setEtape(`Génération du document ${format.toUpperCase()}…`);
      const genere = await genererDocument(doc.id, format);
      setEtape('Téléchargement…');
      const fichier = await telechargerDocument(genere, 'genere');
      onTermine(genere, fichier);
    } catch (err) {
      // L'original est conservé ; aucun document invalide n'est proposé.
      setErreur(`${messageErreur(err, 'La génération a échoué.')} Le document original est conservé intact.`);
      setEtape('');
    }
  }

  const options = [
    { id: 'pdf', label: 'PDF', ext: '.pdf', dispo: true },
    { id: 'docx', label: 'Word', ext: '.docx', dispo: !local },
  ];

  return (
    <div className="modale-fond" onClick={() => !enCours && onFermer()}>
      <div className="carte modale" role="dialog" aria-modal="true" aria-labelledby="titre-export" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 id="titre-export" style={{ fontSize: 18, fontWeight: 700 }}>Télécharger avec les QR codes</h2>
            <p style={{ fontSize: 12, color: 'var(--texte2)', marginTop: 2 }}>
              {nbQr} QR code(s), chacun avec son nom unique
            </p>
          </div>
          <button onClick={onFermer} disabled={enCours} aria-label="Fermer" style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--texte3)', lineHeight: 1 }}>✕</button>
        </div>

        <div className="choix-format" role="radiogroup" aria-label="Format de sortie">
          {options.map(o => (
            <label key={o.id} className={`${format === o.id ? 'actif' : ''}${!o.dispo ? ' desactive' : ''}`} style={{ position: 'relative' }}>
              <input type="radio" name="format" value={o.id} checked={format === o.id} disabled={!o.dispo || enCours} onChange={() => { setFormat(o.id); setCompris(false); }} />
              <strong>{o.label} <span style={{ fontWeight: 400, color: 'var(--texte3)', fontSize: 12 }}>{o.ext}</span></strong>
              <span>{o.dispo ? REGLES[doc.format]?.[o.id] : 'Nécessite le moteur de génération du serveur.'}</span>
            </label>
          ))}
        </div>

        {reconstruction && (
          <div className="bandeau bandeau-alerte">
            <span aria-hidden>⚠️</span>
            <div>
              <p>L'export Word d'un PDF implique une <strong>reconstruction du document</strong> : la mise en page d'origine
                (polices, tableaux, positionnement) ne sera pas parfaitement conservée.</p>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, fontWeight: 600 }}>
                <input type="checkbox" checked={compris} onChange={e => setCompris(e.target.checked)} disabled={enCours} />
                J'ai compris, continuer en Word
              </label>
            </div>
          </div>
        )}

        {doc.format === 'docx' && format === 'docx' && (
          <div className="bandeau bandeau-info">
            <span aria-hidden>ℹ️</span>
            <span>Le rendu d'un document Word peut légèrement varier selon le logiciel utilisé. Une conversion de contrôle en PDF est réalisée pour vérifier le résultat.</span>
          </div>
        )}

        {bloquant && <div className="message-erreur">{bloquant}</div>}
        {erreur && <div className="message-erreur" role="alert">{erreur}</div>}
        {enCours && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 13, color: 'var(--texte2)' }}>{etape}</p>
            <div className="barre-progression"><div style={{ width: '60%', animation: 'none' }} /></div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={onFermer} disabled={enCours}>Annuler</button>
          <button
            className="btn btn-primaire"
            onClick={lancer}
            disabled={enCours || Boolean(bloquant) || (reconstruction && !compris)}
          >
            {enCours ? 'Préparation…' : '⬇ Télécharger'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--texte3)' }}>Le document original est toujours conservé : un nouveau fichier est généré.</p>
      </div>
    </div>
  );
}
