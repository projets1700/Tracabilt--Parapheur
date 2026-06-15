import { useState, useEffect, useCallback } from 'react';
import client from '../../api/client';

const TYPES = {
  scan:   { label: 'Scan',   classe: 'badge-bleu' },
  sync:   { label: 'Sync',   classe: 'badge-violet' },
  alerte: { label: 'Alerte', classe: 'badge-rouge' },
};

function formaterDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const LIMITE = 50;

export default function PageEvenements() {
  const [evenements, setEvenements] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [filtreType, setFiltreType] = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const params = { page, limite: LIMITE };
      if (filtreType) params.type = filtreType;
      const { data } = await client.get('/evenements', { params });
      setEvenements(data.evenements);
      setTotal(data.total);
    } catch {
    } finally {
      setChargement(false);
    }
  }, [page, filtreType]);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => { setPage(1); }, [filtreType]);

  const nbPages = Math.ceil(total / LIMITE);

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Événements</h1>
          <p style={{ color: 'var(--texte2)', fontSize: 13, marginTop: 4 }}>{total} au total</p>
        </div>
        <select className="champ" style={{ maxWidth: 160 }} value={filtreType} onChange={e => setFiltreType(e.target.value)}>
          <option value="">Tous les types</option>
          {Object.entries(TYPES).map(([val, { label }]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      <div className="carte" style={{ padding: 0, overflow: 'hidden' }}>
        {chargement ? (
          <div className="chargement">Chargement…</div>
        ) : evenements.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--texte3)' }}>Aucun événement.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--fond2)', borderBottom: '1px solid var(--bordure)' }}>
                {['Parapheur', 'Type', 'Opérateur', 'Localisation', 'Coordonnées GPS', 'Date'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--texte2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {evenements.map(ev => (
                <tr key={ev.id} style={{ borderBottom: '1px solid var(--bordure)' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: 13 }}>{ev.parapheur_reference}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span className={`badge ${TYPES[ev.type]?.classe || 'badge-gris'}`}>
                      {TYPES[ev.type]?.label || ev.type}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13 }}>{ev.operateur_nom || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--texte2)' }}>{ev.localisation_nom || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--texte3)', fontFamily: 'monospace' }}>
                    {ev.latitude ? `${parseFloat(ev.latitude).toFixed(4)}, ${parseFloat(ev.longitude).toFixed(4)}` : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--texte2)' }}>{formaterDate(ev.cree_le)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
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