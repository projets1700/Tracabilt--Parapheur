import { useEffect, useState } from 'react';
import { obtenirHistorique, messageErreur } from '../services/documentsApi';

const ICONES = {
  import: '📥',
  ajout_qr: '➕',
  suppression_qr: '🗑️',
  modification_position: '↔️',
  generation: '⚙️',
  export: '⬇️',
  association_parapheur: '🔗',
};

function formaterDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Historique des opérations documentaires (§3.8) : date, utilisateur, description.
 */
export default function HistoriqueDocument({ documentId, rafraichir = 0 }) {
  const [evts, setEvts] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let actif = true;
    obtenirHistorique(documentId)
      .then(e => { if (actif) { setEvts(e); setErreur(''); } })
      .catch(err => actif && setErreur(messageErreur(err, "Impossible de charger l'historique.")));
    return () => { actif = false; };
  }, [documentId, rafraichir]);

  if (erreur) return <p style={{ fontSize: 12, color: 'var(--rouge)' }}>{erreur}</p>;
  if (!evts) return <p style={{ fontSize: 12, color: 'var(--texte3)' }}>Chargement…</p>;
  if (!evts.length) return <p style={{ fontSize: 12, color: 'var(--texte3)' }}>Aucun événement.</p>;

  return (
    <div className="historique">
      {evts.map(e => (
        <div key={e.id} className="evt" style={e.details?.echec ? { borderLeftColor: 'var(--rouge)' } : undefined}>
          <strong>{ICONES[e.action] || '•'} {e.description}</strong>
          <small>{formaterDate(e.date)} — {e.utilisateur}</small>
        </div>
      ))}
    </div>
  );
}
