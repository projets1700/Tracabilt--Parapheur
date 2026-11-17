import { useEffect, useState } from 'react';
import { qrDataUrl } from '../utils/qr';
import { pointsVersMm } from '../utils/coordonnees';

function Vignette({ contenu }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let actif = true;
    qrDataUrl(contenu).then(u => actif && setUrl(u)).catch(() => {});
    return () => { actif = false; };
  }, [contenu]);
  return url ? <img src={url} alt="" /> : <span style={{ width: 30, height: 30, background: 'var(--fond2)' }} />;
}

/**
 * Liste des QR codes présents dans le document (panneau latéral) :
 * sélection d'un QR code et suppression.
 */
export default function ListeQRCodes({ qrcodes, selection, onSelectionner, onSupprimer, verrouille = false }) {
  if (!qrcodes.length) {
    return <p style={{ fontSize: 12, color: 'var(--texte3)' }}>Aucun QR code dans ce document.</p>;
  }
  const tries = [...qrcodes].sort((a, b) => a.page - b.page || a.y - b.y);
  return (
    <div className="liste-qr">
      {tries.map(q => (
        <div key={q.cle} className={`item-qr${q.cle === selection ? ' selectionne' : ''}`}>
          <button type="button" className="item-qr-corps" onClick={() => onSelectionner(q.cle, q.page)}>
            <Vignette contenu={q.contenu} />
            <span style={{ minWidth: 0 }}>
              <strong>{q.numero || q.reference}</strong>
              <small>Page {q.page} · {Math.round(pointsVersMm(q.largeur))} mm</small>
            </span>
          </button>
          {onSupprimer && !verrouille && (
            <button
              type="button"
              className="item-qr-suppr"
              onClick={() => onSupprimer(q.cle)}
              title={`Supprimer le QR code ${q.numero || q.reference}`}
              aria-label={`Supprimer le QR code ${q.numero || q.reference}`}
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
