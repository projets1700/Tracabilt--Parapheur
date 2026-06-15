import { useState, useEffect, useCallback } from 'react';
import client from '../../api/client';

const STATUTS = {
  en_transit: { label: 'En transit', classe: 'badge-vert' },
  livre:      { label: 'Livré',      classe: 'badge-bleu' },
  en_attente: { label: 'En attente', classe: 'badge-orange' },
  archive:    { label: 'Archivé',    classe: 'badge-gris' },
};

function formaterDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Modal({ titre, onFermer, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div className="carte" style={{ width: '100%', maxWidth: 440, padding: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{titre}</h2>
        {children}
      </div>
    </div>
  );
}

export default function PageParapheurs() {
  const [parapheurs, setParapheurs] = useState([]);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [modal, setModal] = useState(null); // null | 'ajout' | objet parapheur
  const [form, setForm] = useState({ reference: '', description: '', statut: 'en_transit' });
  const [erreurForm, setErreurForm] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const params = {};
      if (recherche) params.recherche = recherche;
      if (filtreStatut) params.statut = filtreStatut;
      const { data } = await client.get('/parapheurs', { params });
      setParapheurs(data.parapheurs);
      setTotal(data.total);
    } catch {
    } finally {
      setChargement(false);
    }
  }, [recherche, filtreStatut]);

  useEffect(() => { charger(); }, [charger]);

  function ouvrirAjout() {
    setForm({ reference: '', description: '', statut: 'en_transit' });
    setErreurForm('');
    setModal('ajout');
  }

  function ouvrirEdit(p) {
    setForm({ reference: p.reference, description: p.description || '', statut: p.statut });
    setErreurForm('');
    setModal(p);
  }

  async function handleSoumettre(e) {
    e.preventDefault();
    setErreurForm('');
    setEnvoi(true);
    try {
      if (modal === 'ajout') {
        await client.post('/parapheurs', { reference: form.reference, description: form.description });
      } else {
        await client.put(`/parapheurs/${modal.id}`, { description: form.description, statut: form.statut });
      }
      setModal(null);
      charger();
    } catch (err) {
      setErreurForm(err.response?.data?.message || 'Erreur lors de l\'enregistrement.');
    } finally {
      setEnvoi(false);
    }
  }

  async function handleSupprimer(p) {
    if (!confirm(`Supprimer le parapheur ${p.reference} ? Cette action est irréversible.`)) return;
    try {
      await client.delete(`/parapheurs/${p.id}`);
      charger();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la suppression.');
    }
  }

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Parapheurs</h1>
          <p style={{ color: 'var(--texte2)', fontSize: 13, marginTop: 4 }}>{total} au total</p>
        </div>
        <button className="btn btn-primaire" onClick={ouvrirAjout}>+ Nouveau</button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          className="champ"
          style={{ maxWidth: 280 }}
          placeholder="Rechercher par référence…"
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
        />
        <select className="champ" style={{ maxWidth: 180 }} value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS).map(([val, { label }]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* Tableau */}
      <div className="carte" style={{ padding: 0, overflow: 'hidden' }}>
        {chargement ? (
          <div className="chargement">Chargement…</div>
        ) : parapheurs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--texte3)' }}>Aucun parapheur trouvé.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--fond2)', borderBottom: '1px solid var(--bordure)' }}>
                {['Référence', 'Description', 'Statut', 'Dernier scan', 'Opérateur', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--texte2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parapheurs.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--bordure)' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: 13 }}>{p.reference}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--texte2)', fontSize: 13, maxWidth: 200 }}>{p.description || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span className={`badge ${STATUTS[p.statut]?.classe || 'badge-gris'}`}>
                      {STATUTS[p.statut]?.label || p.statut}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--texte2)' }}>{formaterDate(p.dernier_scan)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--texte2)' }}>{p.dernier_operateur || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => ouvrirEdit(p)}>Modifier</button>
                      <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleSupprimer(p)}>Supprimer</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal ajout / modification */}
      {modal && (
        <Modal titre={modal === 'ajout' ? 'Nouveau parapheur' : 'Modifier le parapheur'} onFermer={() => setModal(null)}>
          <form onSubmit={handleSoumettre} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="label-champ">Référence</label>
              <input
                className="champ"
                placeholder="PAR-2025-00001"
                value={form.reference}
                onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                required
                disabled={modal !== 'ajout'}
              />
            </div>
            <div>
              <label className="label-champ">Description</label>
              <input
                className="champ"
                placeholder="Description optionnelle"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            {modal !== 'ajout' && (
              <div>
                <label className="label-champ">Statut</label>
                <select className="champ" value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}>
                  {Object.entries(STATUTS).map(([val, { label }]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            )}
            {erreurForm && <div className="message-erreur">{erreurForm}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setModal(null)}>Annuler</button>
              <button type="submit" className="btn btn-primaire" disabled={envoi}>
                {envoi ? 'Enregistrement…' : (modal === 'ajout' ? 'Créer' : 'Enregistrer')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}