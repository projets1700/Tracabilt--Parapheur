import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function PageConnexionAdmin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifiant: '', mot_de_passe: '' });
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('admin_token')) {
      navigate('/admin', { replace: true });
      return;
    }
    client.get('/admin/existe').then(({ data }) => {
      if (!data.existe) navigate('/admin/inscription', { replace: true });
    });
  }, [navigate]);

  function changer(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErreur('');
    setChargement(true);
    try {
      const { data } = await client.post('/admin/connexion', form);
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.utilisateur));
      navigate('/admin', { replace: true });
    } catch (err) {
      setErreur(err.response?.data?.message || 'Identifiants incorrects.');
    } finally {
      setChargement(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bleu)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 36, width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏛️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Administration</h1>
          <p style={{ fontSize: 13, color: 'var(--texte2)', marginTop: 6 }}>TraçaParapheur</p>
        </div>

        {erreur && <div className="message-erreur" style={{ marginBottom: 16 }}>{erreur}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label-champ">Identifiant</label>
            <input className="champ" name="identifiant" value={form.identifiant} onChange={changer} autoCapitalize="none" required />
          </div>
          <div>
            <label className="label-champ">Mot de passe</label>
            <input className="champ" type="password" name="mot_de_passe" value={form.mot_de_passe} onChange={changer} required />
          </div>
          <button className="btn btn-primaire" type="submit" disabled={chargement} style={{ marginTop: 6, padding: '12px 0', fontSize: 14, justifyContent: 'center' }}>
            {chargement ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
