import { useState } from 'react';
import client from '../api/client';

const STATUTS = {
  en_circulation: { label: 'En circulation', classe: 'badge-vert' },
  archive:        { label: 'Archivé',         classe: 'badge-gris' },
};

function formaterDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function PageVisionneur() {
  const [recherche, setRecherche] = useState('');
  const [resultat, setResultat] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');

  async function handleRecherche(e) {
    e.preventDefault();
    if (!recherche.trim()) return;
    setChargement(true);
    setErreur('');
    setResultat(null);
    try {
      const { data } = await client.get(`/parapheurs/${recherche.trim().toUpperCase()}`);
      setResultat(data);
    } catch (err) {
      if (err.response?.status === 404) {
        setErreur('Aucun parapheur trouvé avec ce numéro.');
      } else {
        setErreur('Erreur lors de la recherche. Veuillez réessayer.');
      }
    } finally {
      setChargement(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fond-page)' }}>

      <header style={{ background: 'white', borderBottom: '1px solid var(--bordure)', padding: '20px 24px' }}>
        <div style={{ marginBottom: 16 }}>
          <img src="/Logo_app.png" alt="CoeurTrace" style={{ height: 120, width: 'auto', objectFit: 'contain' }} />
        </div>
        <form onSubmit={handleRecherche} style={{ display: 'flex', gap: 8, maxWidth: 640 }}>
          <input
            className="champ"
            style={{ flex: 1 }}
            placeholder="Numéro de parapheur (ex : PAR-2025-00142)"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
          />
          <button className="btn btn-primaire" type="submit" style={{ flexShrink: 0 }}>
            Rechercher
          </button>
        </form>
      </header>

      <main className="conteneur" style={{ padding: '24px 24px' }}>
        {chargement && <div className="chargement">Recherche en cours…</div>}
        {erreur && <div className="message-erreur" style={{ maxWidth: 480, margin: '0 auto' }}>{erreur}</div>}

        {!resultat && !chargement && !erreur && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--texte3)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <p style={{ fontSize: 16, fontWeight: 500 }}>Saisir un numéro de parapheur</p>
            <p style={{ fontSize: 13, marginTop: 6 }}>Exemple : PAR-2025-00001</p>
          </div>
        )}

        {resultat && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800, margin: '0 auto' }}>

            <div className="carte">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>Parapheur {resultat.numero}</h2>
                  <p style={{ fontSize: 13, color: 'var(--texte2)', marginTop: 4 }}>{resultat.titre || '—'}</p>
                  <p style={{ fontSize: 12, color: 'var(--texte3)', marginTop: 2 }}>Créé le {formaterDate(resultat.created_at)}</p>
                </div>
                <span className={`badge ${STATUTS[resultat.statut]?.classe || 'badge-gris'}`}>
                  {STATUTS[resultat.statut]?.label || resultat.statut}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'var(--fond2)', borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 12, color: 'var(--texte2)' }}>Opérateur dernier scan</p>
                  <p style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                    {resultat.scans?.[0]?.operateur_nom || '—'}
                  </p>
                </div>
                <div style={{ background: 'var(--fond2)', borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 12, color: 'var(--texte2)' }}>Dernier scan</p>
                  <p style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                    {formaterDate(resultat.scans?.[0]?.scanned_at)}
                  </p>
                </div>
              </div>
            </div>

            <div className="carte">
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                Historique des scans ({resultat.scans?.length || 0})
              </h3>
              {!resultat.scans?.length ? (
                <p style={{ color: 'var(--texte3)', fontSize: 13 }}>Aucun scan enregistré.</p>
              ) : (
                <div>
                  {resultat.scans.map((sc, i) => (
                    <div key={sc.id} style={{ display: 'flex', gap: 12, paddingBottom: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 3,
                          background: i === 0 ? 'var(--bleu)' : 'var(--vert)',
                        }} />
                        {i < resultat.scans.length - 1 && (
                          <div style={{ width: 1.5, flexGrow: 1, background: 'var(--bordure)', margin: '4px auto' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 4 }}>
                        <p style={{ fontSize: 13, fontWeight: 500 }}>{sc.operateur_nom || 'Scanner inconnu'}</p>
                        {sc.nom_lieu && (
                          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--bleu)', marginTop: 2 }}>
                            📍 {sc.nom_lieu}
                          </p>
                        )}
                        <p style={{ fontSize: 12, color: 'var(--texte2)', marginTop: 2 }}>
                          {formaterDate(sc.scanned_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}