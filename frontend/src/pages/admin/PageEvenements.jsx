import { useState, useEffect, useCallback } from 'react';
import client from '../../api/client';

function formaterDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const LIMITE = 50;

export default function PageEvenements() {
  const [scans, setScans] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const { data } = await client.get('/scans', { params: { page, limite: LIMITE } });
      setScans(data.scans);
      setTotal(data.total);
    } catch {
    } finally {
      setChargement(false);
    }
  }, [page]);

  useEffect(() => { charger(); }, [charger]);

  const nbPages = Math.ceil(total / LIMITE);

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Scans</h1>
        <p style={{ color: 'var(--texte2)', fontSize: 13, marginTop: 4 }}>{total} au total</p>
      </div>

      <div className="carte" style={{ padding: 0, overflow: 'hidden' }}>
        {chargement ? (
          <div className="chargement">Chargement…</div>
        ) : scans.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--texte3)' }}>Aucun scan.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--fond2)', borderBottom: '1px solid var(--bordure)' }}>
                {['Parapheur', 'Opérateur', 'Coordonnées GPS', 'Précision', 'Date du scan'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--texte2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scans.map(sc => (
                <tr key={sc.id} style={{ borderBottom: '1px solid var(--bordure)' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: 13 }}>{sc.parapheur_numero}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13 }}>{sc.operateur_nom || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--texte3)', fontFamily: 'monospace' }}>
                    {sc.latitude ? `${parseFloat(sc.latitude).toFixed(4)}, ${parseFloat(sc.longitude).toFixed(4)}` : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--texte2)' }}>
                    {sc.precision_gps ? `±${sc.precision_gps}m` : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--texte2)' }}>{formaterDate(sc.scanned_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {nbPages > 1 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
          <button className="btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Précédent</button>
          <span style={{ fontSize: 13, color: 'var(--texte2)' }}>Page {page} / {nbPages}</span>
          <button className="btn" disabled={page === nbPages} onClick={() => setPage(p => p + 1)}>Suivant →</button>
        </div>
      )}
    </div>
  );
}