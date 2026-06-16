import { useState, useEffect } from 'react';
import client from '../../api/client';

function formaterDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function PageUtilisateurs() {
  const [scanners, setScanners] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [form, setForm] = useState({ nom: '', identifiant: '', mot_de_passe: '', device_id: '' });
  const [erreurForm, setErreurForm] = useState('');
  const [envoi, setEnvoi] = useState(false);

  async function charger() {
    setChargement(true);
    try {
      const { data } = await client.get('/scanners');
      setScanners(data);
    } catch {
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => { charger(); }, []);

  function ouvrirModal() {
    setForm({ nom: '', identifiant: '', mot_de_passe: '', device_id: '' });
    setErreurForm('');
    setModalOuvert(true);
  }

  async function handleSoumettre(e) {
    e.preventDefault();
    setErreurForm('');
    setEnvoi(true);
    try {
      await client.post('/scanners', form);
      setModalOuvert(false);
      charger();
    } catch (err) {
      setErreurForm(err.response?.data?.message || 'Erreur lors de la création.');
    } finally {
      setEnvoi(false);
    }
  }

  async function toggleActif(s) {
    try {
      await client.put(`/scanners/${s.id}`, { is_active: !s.is_active });
      charger();
    } catch {}
  }

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Scanners</h1>
          <p style={{ color: 'var(--texte2)', fontSize: 13, marginTop: 4 }}>{scanners.length} au total</p>
        </div>
        <button className="btn btn-primaire" onClick={ouvrirModal}>+ Nouveau scanner</button>
      </div>

      <div className="carte" style={{ padding: 0, overflow: 'hidden' }}>
        {chargement ? (
          <div className="chargement">Chargement…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--fond2)', borderBottom: '1px solid var(--bordure)' }}>
                {['Nom', 'Identifiant', 'Appareil', 'Statut', 'Créé le', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--texte2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scanners.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--bordure)', opacity: s.is_active ? 1 : 0.5 }}>
                  <td style={{ padding: '12px 14px', fontWeight: 500 }}>{s.nom}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--texte2)', fontSize: 13, fontFamily: 'monospace' }}>{s.identifiant}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--texte2)', fontSize: 12 }}>{s.device_id || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span className={`badge ${s.is_active ? 'badge-vert' : 'badge-gris'}`}>
                      {s.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--texte2)' }}>{formaterDate(s.created_at)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggleActif(s)}>
                      {s.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOuvert && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="carte" style={{ width: '100%', maxWidth: 440, padding: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Nouveau scanner</h2>
            <form onSubmit={handleSoumettre} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label-champ">Nom</label>
                <input className="champ" required value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
              </div>
              <div>
                <label className="label-champ">Identifiant</label>
                <input className="champ" required value={form.identifiant} onChange={e => setForm(f => ({ ...f, identifiant: e.target.value }))} placeholder="p.nom" />
              </div>
              <div>
                <label className="label-champ">Mot de passe</label>
                <input className="champ" type="password" required minLength={6} value={form.mot_de_passe} onChange={e => setForm(f => ({ ...f, mot_de_passe: e.target.value }))} />
              </div>
              <div>
                <label className="label-champ">ID appareil (optionnel)</label>
                <input className="champ" value={form.device_id} onChange={e => setForm(f => ({ ...f, device_id: e.target.value }))} placeholder="ANDROID-001" />
              </div>
              {erreurForm && <div className="message-erreur">{erreurForm}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setModalOuvert(false)}>Annuler</button>
                <button type="submit" className="btn btn-primaire" disabled={envoi}>
                  {envoi ? 'Création…' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}