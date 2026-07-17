import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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

export default function PageDetailParapheur() {
  const { numero } = useParams();
  const [parapheur, setParapheur] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur]         = useState('');

  useEffect(() => {
    client.get(`/parapheurs/${numero.toUpperCase()}`)
      .then(({ data }) => setParapheur(data))
      .catch(err => {
        if (err.response?.status === 404) setErreur('Parapheur introuvable.');
        else setErreur('Erreur lors du chargement.');
      })
      .finally(() => setChargement(false));
  }, [numero]);

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FA' }}>

      {/* Header */}
      <header style={{
        background: 'var(--vert-bandeau)', borderBottom: '1px solid var(--bordure)', padding: '2px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap',
      }}>
        <img src="/Logo_Parapheur.png" alt="CoeurTrace" style={{ width: 150, height: 'auto', objectFit: 'contain' }} />
        <Link to="/parapheurs" style={{ fontSize: 12, color: 'var(--vert-fonce)', textDecoration: 'none', fontWeight: 600 }}>← Retour à l'accueil</Link>
      </header>

      <main style={{ padding: '28px 32px', maxWidth: 860, margin: '0 auto' }}>

        {chargement && <div className="chargement">Chargement…</div>}
        {erreur     && <div className="message-erreur">{erreur}</div>}

        {parapheur && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Fiche parapheur */}
            <div className="carte">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: 12, color: '#9AA3AE', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>Parapheur</p>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--bleu)' }}>{parapheur.numero}</h1>
                  {parapheur.titre && <p style={{ fontSize: 14, color: '#5A6472', marginTop: 4 }}>{parapheur.titre}</p>}
                  <p style={{ fontSize: 12, color: '#9AA3AE', marginTop: 6 }}>Créé le {formaterDate(parapheur.created_at)}</p>
                </div>
                <span className={`badge ${STATUTS[parapheur.statut]?.classe || 'badge-gris'}`} style={{ fontSize: 12 }}>
                  {STATUTS[parapheur.statut]?.label || parapheur.statut}
                </span>
              </div>

              {parapheur.scans?.length > 0 && (
                <>
                  <div className="sep" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div style={{ background: '#F4F7FA', borderRadius: 10, padding: '12px 16px' }}>
                      <p style={{ fontSize: 11, color: '#9AA3AE', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Dernier scan</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--bleu)', marginTop: 4 }}>{formaterDate(parapheur.scans[0].scanned_at)}</p>
                    </div>
                    <div style={{ background: '#F4F7FA', borderRadius: 10, padding: '12px 16px' }}>
                      <p style={{ fontSize: 11, color: '#9AA3AE', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Opérateur</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--bleu)', marginTop: 4 }}>{parapheur.scans[0].operateur_nom || '—'}</p>
                    </div>
                    <div style={{ background: '#F4F7FA', borderRadius: 10, padding: '12px 16px' }}>
                      <p style={{ fontSize: 11, color: '#9AA3AE', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Localisation</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--bleu)', marginTop: 4 }}>{parapheur.scans[0].nom_lieu || '—'}</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Historique complet */}
            <div className="carte" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E6EA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--bleu)' }}>Historique complet</h2>
                <span style={{ fontSize: 12, color: '#9AA3AE' }}>{parapheur.scans?.length || 0} scan(s)</span>
              </div>

              {!parapheur.scans?.length ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#9AA3AE', fontSize: 13 }}>
                  Aucun scan enregistré pour ce parapheur.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F4F7FA', borderBottom: '1px solid #E2E6EA' }}>
                      {['#', 'Date et heure', 'Opérateur', 'Localisation', 'Coordonnées GPS'].map(h => (
                        <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 600, color: '#5A6472', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parapheur.scans.map((sc, i) => (
                      <tr key={sc.id} style={{ borderBottom: i < parapheur.scans.length - 1 ? '1px solid #E2E6EA' : 'none' }}>
                        <td style={{ padding: '13px 20px' }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: '50%',
                            background: i === 0 ? 'var(--bleu)' : '#E2E6EA',
                            color: i === 0 ? 'white' : '#5A6472',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700,
                          }}>
                            {i + 1}
                          </div>
                        </td>
                        <td style={{ padding: '13px 20px', fontWeight: i === 0 ? 700 : 400, color: 'var(--bleu)' }}>
                          {formaterDate(sc.scanned_at)}
                          {i === 0 && <span style={{ marginLeft: 8, fontSize: 10, background: 'var(--bleu-clair)', color: 'var(--bleu)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Dernier</span>}
                        </td>
                        <td style={{ padding: '13px 20px', color: 'var(--bleu)' }}>{sc.operateur_nom || '—'}</td>
                        <td style={{ padding: '13px 20px', color: '#5A6472' }}>
                          {sc.nom_lieu ? `📍 ${sc.nom_lieu}` : '—'}
                        </td>
                        <td style={{ padding: '13px 20px', color: '#9AA3AE', fontSize: 12 }}>
                          {sc.latitude && sc.longitude
                            ? `${parseFloat(sc.latitude).toFixed(4)}° N, ${parseFloat(sc.longitude).toFixed(4)}° E`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
