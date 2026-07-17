import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

function LogoCE() {
  return <img src="/Logo_Parapheur.png" alt="CoeurTrace" style={{ width: 300, height: 'auto', objectFit: 'contain' }} />;
}

export default function PageConnexion() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifiant: '', mot_de_passe: '' });
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('admin_token')) {
      navigate('/admin', { replace: true });
    } else if (localStorage.getItem('superviseur_token')) {
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
      const { data } = await client.post('/admin/connexion', form);
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.utilisateur));
      navigate('/admin', { replace: true });
      return;
    } catch {}

    try {
      const { data } = await client.post('/superviseur/connexion', form);
      localStorage.setItem('superviseur_token', data.token);
      localStorage.setItem('superviseur_user', JSON.stringify(data.utilisateur));
      navigate('/parapheurs', { replace: true });
      return;
    } catch {}

    setErreur('Identifiants incorrects.');
    setChargement(false);
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* Panneau gauche – branding */}
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
        <p style={{ fontSize: 13, color: 'var(--texte2)', textAlign: 'center', lineHeight: 1.6 }}>Système de traçabilité{'\n'}des parapheurs</p>
      </div>

      {/* Panneau droit – formulaire */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F7FA', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--bleu)', marginBottom: 6 }}>Connexion</h1>
          <p style={{ fontSize: 13, color: 'var(--texte2)', marginBottom: 32 }}>Espace superviseur ou administrateur</p>

          {erreur && <div className="message-erreur" style={{ marginBottom: 20 }}>{erreur}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label-champ">Identifiant</label>
              <input className="champ" name="identifiant" value={form.identifiant} onChange={changer} autoCapitalize="none" autoFocus required />
            </div>
            <div>
              <label className="label-champ">Mot de passe</label>
              <input className="champ" type="password" name="mot_de_passe" value={form.mot_de_passe} onChange={changer} required />
            </div>
            <button
              className="btn btn-primaire"
              type="submit"
              disabled={chargement}
              style={{ padding: '13px 0', fontSize: 14, justifyContent: 'center', marginTop: 8, borderRadius: 10 }}
            >
              {chargement ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
