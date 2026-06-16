import { useEffect, useState } from 'react';
import client from '../../api/client';

function CarteStats({ icone, valeur, label, couleur }) {
  return (
    <div className="carte" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12, flexShrink: 0,
        background: couleur + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
      }}>
        {icone}
      </div>
      <div>
        <p style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{valeur ?? '—'}</p>
        <p style={{ fontSize: 12, color: 'var(--texte2)', marginTop: 4 }}>{label}</p>
      </div>
    </div>
  );
}

export default function PageDashboard() {
  const [stats, setStats] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    client.get('/scanners/statistiques')
      .then(({ data }) => setStats(data))
      .catch(() => setErreur('Impossible de charger les statistiques.'))
      .finally(() => setChargement(false));
  }, []);

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Tableau de bord</h1>
        <p style={{ color: 'var(--texte2)', fontSize: 13, marginTop: 4 }}>Vue d'ensemble du système</p>
      </div>

      {chargement && <div className="chargement">Chargement…</div>}
      {erreur && <div className="message-erreur" style={{ maxWidth: 480 }}>{erreur}</div>}

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          <CarteStats icone="📋" valeur={stats.parapheurs_actifs}  label="Parapheurs actifs"            couleur="#185FA5" />
          <CarteStats icone="📍" valeur={stats.scans_aujourdhui}   label="Scans aujourd'hui"            couleur="#1D9E75" />
          <CarteStats icone="👥" valeur={stats.operateurs_actifs}  label="Opérateurs actifs aujourd'hui" couleur="#BA7517" />
          <CarteStats icone="📅" valeur={stats.total_scans}        label="Scans au total"                couleur="#534AB7" />
        </div>
      )}
    </div>
  );
}