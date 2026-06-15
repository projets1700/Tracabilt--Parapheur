import { useState, useEffect } from 'react';
import client from '../../api/client';
import { useAuth } from '../../hooks/useAuth.jsx';

function formaterDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function PageUtilisateurs() {
  const { utilisateur: moi } = useAuth();
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [modalOuvert, setModalOuvert] = useState(false);
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', mot_de_passe: '', role: 'operateur' });
  const [erreurForm, setErreurForm] = useState('');
  const [envoi, setEnvoi] = useState(false);

  async function charger() {
    setChargement(true);
    try {
      const { data } = await client.get('/utilisateurs');
      setUtilisateurs(data);
    } catch {
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => { charger(); }, []);

  function ouvrirModal() {
    setForm({ nom: '', prenom: '', email: '', mot_de_passe: '', role: 'operateur' });
    setErreurForm('');
    setModalOuvert(true);
  }

  async function handleSoumettre(e) {
    e.preventDefault();
    setErreurForm('');
    setEnvoi(true);
    try {
      await client.post('/utilisateurs', form);
      setModalOuvert(false);
      charger();
    } catch (err) {
      setErreurForm(err.response?.data?.message || 'Erreur lors de la création.');
    } finally {
      setEnvoi(false);
    }
  }

  async function toggleActif(u) {
    try {
      await client.put(`/utilisateurs/${u.id}`, { actif: !u.actif });
      charger();
    } catch {}
  }

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Utilisateurs</h1>
          <p style={{ color: 'var(--texte2)', fontSize: 13, marginTop: 4 }}>{utilisateurs.length} au total</p>
        </div>
        <button className="btn btn-primaire" onClick={ouvrirModal}>+ Nouvel utilisateur</button>
      </div>

      <div className="carte" style={{ padding: 0, overflow: 'hidden' }}>
        {chargement ? (
          <div className="chargement">Chargement…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--fond2)', borderBottom: '1px solid var(--bordure)' }}>
                {['Nom', 'Email', 'Rôle', 'Statut', 'Créé le', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--texte2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {utilisateurs.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--bordure)', opacity: u.actif ? 1 : 0.5 }}>
                  <td style={{ padding: '12px 14px', fontWeight: 500 }}>{u.prenom} {u.nom}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--texte2)', fontSize: 13 }}>{u.email}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span className={`badge ${u.role === 'administrateur' ? 'badge-violet' : 'badge-bleu'}`}>
                      {u.role === 'administrateur' ? 'Admin' : 'Opérateur'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span className={`badge ${u.actif ? 'badge-vert' : 'badge-gris'}`}>
                      {u.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--texte2)' }}>{formaterDate(u.cree_le)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {u.id !== moi?.id && (
                      <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => toggleActif(u)}>
                        {u.actif ? 'Désactiver' : 'Activer'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalOuvert && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="carte" style={{ width: '100%', maxWidth: 440, padding: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Nouvel utilisateur</h2>
            <form onSubmit={handleSoumettre} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label-champ">Prénom</label>
                  <input className="champ" required value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} />
                </div>
                <div>
                  <label className="label-champ">Nom</label>
                  <input className="champ" required value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label-champ">Email</label>
                <input className="champ" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="label-champ">Mot de passe</label>
                <input className="champ" type="password" required minLength={6} value={form.mot_de_passe} onChange={e => setForm(f => ({ ...f, mot_de_passe: e.target.value }))} />
              </div>
              <div>
                <label className="label-champ">Rôle</label>
                <select className="champ" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="operateur">Opérateur</option>
                  <option value="administrateur">Administrateur</option>
                </select>
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