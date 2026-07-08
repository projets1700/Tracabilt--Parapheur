import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function PageInscriptionAdmin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nom: '', identifiant: '', mot_de_passe: '', confirmer: '' });
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('admin_token')) {
      navigate('/admin', { replace: true });
      return;
    }
    client.get('/admin/existe').then(({ data }) => {
      if (data.existe) navigate('/admin/connexion', { replace: true });
    });
  }, [navigate]);

  function changer(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErreur('');
    if (form.mot_de_passe !== form.confirmer) {
      return setErreur('Les mots de passe ne correspondent pas.');
    }
    if (form.mot_de_passe.length < 6) {
      return setErreur('Le mot de passe doit contenir au moins 6 caractères.');
    }
    setChargement(true);
    try {
      const { data } = await client.post('/admin/inscription', {
        nom: form.nom,
        identifiant: form.identifiant,
        mot_de_passe: form.mot_de_passe,
      });
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.utilisateur));
      navigate('/admin', { replace: true });
    } catch (err) {
      setErreur(err.response?.data?.message || 'Erreur lors de la création du compte.');
    } finally {
      setChargement(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bleu)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 36, width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Créer le compte administrateur</h1>
          <p style={{ fontSize: 13, color: 'var(--texte2)', marginTop: 6 }}>Première configuration — ce compte sera unique</p>
        </div>

        {erreur && <div className="message-erreur" style={{ marginBottom: 16 }}>{erreur}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label-champ">Nom complet</label>
            <input className="champ" name="nom" value={form.nom} onChange={changer} placeholder="Ex : Marie Dupont" required />
          </div>
          <div>
            <label className="label-champ">Identifiant de connexion</label>
            <input className="champ" name="identifiant" value={form.identifiant} onChange={changer} placeholder="Ex : admin" autoCapitalize="none" required />
          </div>
          <div>
            <label className="label-champ">Mot de passe</label>
            <input className="champ" type="password" name="mot_de_passe" value={form.mot_de_passe} onChange={changer} placeholder="6 caractères minimum" required />
          </div>
          <div>
            <label className="label-champ">Confirmer le mot de passe</label>
            <input className="champ" type="password" name="confirmer" value={form.confirmer} onChange={changer} placeholder="Répétez le mot de passe" required />
          </div>
          <button className="btn btn-primaire" type="submit" disabled={chargement} style={{ marginTop: 6, padding: '12px 0', fontSize: 14, justifyContent: 'center' }}>
            {chargement ? 'Création…' : 'Créer le compte'}
          </button>
        </form>
      </div>
    </div>
  );
}
