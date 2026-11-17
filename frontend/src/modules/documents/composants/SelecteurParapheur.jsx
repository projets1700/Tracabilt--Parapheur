import { useEffect, useMemo, useRef, useState } from 'react';
import useParapheurs from '../hooks/useParapheurs';

/**
 * Sélection d'un parapheur existant (§3.7), avec recherche par numéro ou titre.
 */
export default function SelecteurParapheur({ valeur, onChange, desactive = false }) {
  const { liste, chargement, erreur } = useParapheurs();
  const [recherche, setRecherche] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [indexActif, setIndexActif] = useState(0);
  const conteneur = useRef(null);

  const filtres = useMemo(() => {
    const r = recherche.trim().toLowerCase();
    return liste
      .filter(p => !r || p.numero.toLowerCase().includes(r) || (p.titre || '').toLowerCase().includes(r))
      .slice(0, 50);
  }, [liste, recherche]);

  useEffect(() => {
    function fermer(e) {
      if (conteneur.current && !conteneur.current.contains(e.target)) setOuvert(false);
    }
    document.addEventListener('mousedown', fermer);
    return () => document.removeEventListener('mousedown', fermer);
  }, []);

  function choisir(p) {
    onChange(p);
    setRecherche('');
    setOuvert(false);
  }

  if (valeur) {
    return (
      <div className="parapheur-choisi">
        <div style={{ minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 13 }}>{valeur.numero}</p>
          {valeur.titre && valeur.titre !== valeur.numero && (
            <p style={{ fontSize: 11, color: 'var(--texte2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{valeur.titre}</p>
          )}
        </div>
        {!desactive && (
          <button type="button" className="btn btn-petit" onClick={() => onChange(null)}>Changer</button>
        )}
      </div>
    );
  }

  return (
    <div className="selecteur-parapheur" ref={conteneur}>
      <input
        className="champ"
        placeholder={chargement ? 'Chargement des parapheurs…' : 'Rechercher un parapheur (numéro ou titre)'}
        value={recherche}
        disabled={desactive || chargement}
        onFocus={() => setOuvert(true)}
        onChange={e => { setRecherche(e.target.value); setOuvert(true); setIndexActif(0); }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setIndexActif(i => Math.min(i + 1, filtres.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setIndexActif(i => Math.max(i - 1, 0)); }
          else if (e.key === 'Enter' && filtres[indexActif]) { e.preventDefault(); choisir(filtres[indexActif]); }
          else if (e.key === 'Escape') setOuvert(false);
        }}
        aria-label="Rechercher un parapheur"
      />
      {erreur && <p style={{ fontSize: 12, color: 'var(--rouge)', marginTop: 4 }}>{erreur}</p>}
      {ouvert && !chargement && (
        <div className="liste" role="listbox">
          {filtres.length === 0 ? (
            <p style={{ padding: 12, fontSize: 12, color: 'var(--texte3)' }}>Aucun parapheur trouvé.</p>
          ) : filtres.map((p, i) => (
            <button
              type="button"
              key={p.id}
              className={`option${i === indexActif ? ' active' : ''}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => choisir(p)}
              role="option"
              aria-selected={i === indexActif}
            >
              <strong>{p.numero}</strong>
              {p.titre && p.titre !== p.numero && <small>{p.titre}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
