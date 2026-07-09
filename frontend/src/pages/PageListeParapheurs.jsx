import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';

function formaterDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUTS = {
  en_circulation: { label: 'En circulation', classe: 'badge-vert' },
  archive:        { label: 'Archivé',         classe: 'badge-gris' },
};

export default function PageListeParapheurs() {
  const [parapheurs, setParapheurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur]         = useState('');
  const [recherche, setRecherche]   = useState('');

  useEffect(() => {
    client.get('/parapheurs?limite=500')
      .then(({ data }) => setParapheurs(data.parapheurs))
      .catch(() => setErreur('Impossible de charger les parapheurs.'))
      .finally(() => setChargement(false));
  }, []);

  const filtres = parapheurs.filter(p =>
    p.numero.toLowerCase().includes(recherche.toLowerCase()) ||
    (p.titre || '').toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FA' }}>

      {/* Header */}
      <header style={{
        background: 'white', borderBottom: '1px solid var(--bordure)', padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap',
      }}>
        <img src="/Logo_Parapheur.png" alt="CoeurTrace" style={{ width: 300, height: 'auto', objectFit: 'contain' }} />
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <Link to="/" style={{ fontSize: 12, color: 'var(--texte2)', textDecoration: 'none' }}>Recherche</Link>
          <Link to="/admin" style={{ fontSize: 12, color: 'var(--texte2)', textDecoration: 'none' }}>Administration</Link>
        </div>
      </header>

      {/* Sous-header */}
      <div style={{ background: 'white', borderBottom: '1px solid #E2E6EA', padding: '20px 32px 0' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--bleu)', marginBottom: 4 }}>Parapheurs</h1>
        <p style={{ fontSize: 12, color: '#9AA3AE', marginBottom: 16 }}>
          {chargement ? '…' : `${parapheurs.length} parapheur(s) — triés du plus récemment scanné au moins récent`}
        </p>

        {/* Barre de recherche */}
        <div style={{ maxWidth: 400, marginBottom: 0 }}>
          <input
            className="champ"
            placeholder="Filtrer par numéro ou titre…"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            style={{ background: '#F4F7FA' }}
          />
        </div>

        {/* Tabs fictif pour le style */}
        <div style={{ display: 'flex', marginTop: 16 }}>
          <div style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, color: 'var(--bleu)', borderBottom: '2px solid var(--bleu)', marginBottom: -1 }}>
            Tous les parapheurs
          </div>
        </div>
      </div>

      {/* Contenu */}
      <main style={{ padding: '28px 32px' }}>
        {chargement && <div className="chargement">Chargement…</div>}
        {erreur    && <div className="message-erreur">{erreur}</div>}

        {!chargement && !erreur && filtres.length === 0 && (
          <div className="carte" style={{ textAlign: 'center', padding: 60, color: '#9AA3AE' }}>
            <p style={{ fontSize: 15 }}>Aucun parapheur trouvé.</p>
          </div>
        )}

        {!chargement && filtres.length > 0 && (
          <div className="carte" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F4F7FA', borderBottom: '1px solid #E2E6EA' }}>
                  {['Numéro / Titre', 'Statut', 'Dernier scan', 'Localisation', ''].map(h => (
                    <th key={h} style={{ padding: '11px 20px', textAlign: 'left', fontWeight: 600, color: '#5A6472', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtres.map((p, i) => (
                  <tr
                    key={p.id}
                    style={{ borderBottom: i < filtres.length - 1 ? '1px solid #E2E6EA' : 'none', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F4F7FA'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <td style={{ padding: '14px 20px' }}>
                      <p style={{ fontWeight: 700, color: 'var(--bleu)' }}>{p.numero}</p>
                      {p.titre && <p style={{ fontSize: 12, color: '#5A6472', marginTop: 2 }}>{p.titre}</p>}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span className={`badge ${STATUTS[p.statut]?.classe || 'badge-gris'}`}>
                        {STATUTS[p.statut]?.label || p.statut}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', color: p.dernier_scan ? 'var(--bleu)' : '#9AA3AE' }}>
                      {formaterDate(p.dernier_scan)}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#5A6472' }}>
                      {p.dernier_lieu ? (
                        <span>📍 {p.dernier_lieu}</span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <Link
                        to={`/parapheurs/${p.numero}`}
                        className="btn btn-primaire"
                        style={{ padding: '6px 14px', fontSize: 12, textDecoration: 'none' }}
                      >
                        Voir l'historique
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
