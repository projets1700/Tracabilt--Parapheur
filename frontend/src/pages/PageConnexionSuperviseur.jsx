import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

function LogoCE() {
  return <img src="/Logo_Parapheur.png" alt="CoeurTrace" style={{ width: 300, height: 'auto', objectFit: 'contain' }} />;
}

export default function PageConnexionSuperviseur() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifiant: '', mot_de_passe: '' });
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('superviseur_token')) {
      navigate('/parapheurs', { replace: true });
    }
  }, [navigate]);

  function changer(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErreur('');
    setChargement(true);
    try {
      const { data } = await client.post('/superviseur/connexion', form);
      localStorage.setItem('superviseur_token', data.token);
      localStorage.setItem('superviseur_user', JSON.stringify(data.utilisateur));
      navigate('/parapheurs', { replace: true });
    } catch (err) {
      setErreur(err.response?.data?.message || 'Identifiants incorrects.');
    } finally {
      setChargement(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div style={{
        flex: '0 0 400px',
        background: 'var(--vert-bandeau)',
        borderRight: '1px solid var(--bordure)',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: '48px 40px', gap: 24,
      }}>
        <LogoCE />
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4, color: 'var(--bleu)' }}>Coeur d'Essonne</p>
          <p style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--texte3)' }}>Agglomération</p>
        </div>
        <div style={{ width: 36, height: 2, background: 'var(--bordure)', borderRadius: 2 }} />
        <p style={{ fontSize: 13, color: 'var(--texte2)' }}>Espace superviseur</p>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F7FA', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--bleu)', marginBottom: 6 }}>Connexion</h1>
          <p style={{ fontSize: 13, color: 'var(--texte2)', marginBottom: 32 }}>Espace superviseur — consultation des parapheurs</p>

          {erreur && <div className="message-erreur" style={{ marginBottom: 20 }}>{erreur}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label-champ">Identifiant</label>
              <input className="champ" name="identifiant" value={form.identifiant} onChange={changer} placeholder="Ex : Sup1" autoCapitalize="none" autoFocus required />
            </div>
            <div>
              <label className="label-champ">Code PIN</label>
              <input
                className="champ"
                type="password"
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                name="mot_de_passe"
                value={form.mot_de_passe}
                onChange={e => setForm(f => ({ ...f, mot_de_passe: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                placeholder="1234"
                required
              />
            </div>
            <button className="btn btn-primaire" type="submit" disabled={chargement} style={{ padding: '13px 0', fontSize: 14, justifyContent: 'center', marginTop: 8, borderRadius: 10 }}>
              {chargement ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
