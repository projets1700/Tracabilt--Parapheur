import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

function LogoCE() {
  return (
    <svg width="64" height="72" viewBox="0 0 64 72" fill="none">
      <path d="M32 64C32 64 6 46 6 26C6 15.5 14 8 24 8C27.6 8 31 9.6 32 12.4C33 9.6 36.4 8 40 8C50 8 58 15.5 58 26C58 46 32 64 32 64Z" fill="white"/>
      <circle cx="32" cy="28" r="9" fill="#8DC63F"/>
      <path d="M32 37V48" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
    </svg>
  );
}

export default function PagePremiereConnexionSuperviseur() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifiant: '', mot_de_passe: '', confirmer: '' });
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('superviseur_token');
    const user = JSON.parse(localStorage.getItem('superviseur_user') || 'null');
    if (!token) {
      navigate('/superviseur/connexion', { replace: true });
      return;
    }
    if (user && user.premiere_connexion === false) {
      navigate('/parapheurs', { replace: true });
    }
  }, [navigate]);

  function changer(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErreur('');
    if (form.mot_de_passe !== form.confirmer) return setErreur('Les mots de passe ne correspondent pas.');
    if (form.mot_de_passe.length < 6) return setErreur('Le mot de passe doit contenir au moins 6 caractères.');
    setChargement(true);
    try {
      const token = localStorage.getItem('superviseur_token');
      const { data } = await client.put('/superviseur/moi', {
        identifiant: form.identifiant,
        mot_de_passe: form.mot_de_passe,
      }, { headers: { Authorization: `Bearer ${token}` } });
      localStorage.setItem('superviseur_token', data.token);
      localStorage.setItem('superviseur_user', JSON.stringify(data.utilisateur));
      navigate('/parapheurs', { replace: true });
    } catch (err) {
      setErreur(err.response?.data?.message || 'Erreur lors de la mise à jour.');
    } finally {
      setChargement(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div style={{
        flex: '0 0 400px',
        background: 'linear-gradient(160deg, #007A8A 0%, #005060 100%)',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: '48px 40px', gap: 24,
      }}>
        <LogoCE />
        <div style={{ width: 36, height: 2, background: 'rgba(255,255,255,0.25)', borderRadius: 2 }} />
        <div style={{ textAlign: 'center', color: 'white' }}>
          <p style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>TraçaParapheur</p>
          <p style={{ fontSize: 13, opacity: 0.65 }}>Espace superviseur</p>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F8', padding: 40, overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1D1D1B', marginBottom: 6 }}>Première connexion</h1>
          <p style={{ fontSize: 13, color: 'var(--texte2)', marginBottom: 32 }}>
            Choisissez votre identifiant et votre mot de passe personnel avant de continuer.
          </p>

          {erreur && <div className="message-erreur" style={{ marginBottom: 20 }}>{erreur}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label-champ">Nouvel identifiant</label>
              <input className="champ" name="identifiant" value={form.identifiant} onChange={changer} autoCapitalize="none" autoFocus required />
            </div>
            <div>
              <label className="label-champ">Nouveau mot de passe</label>
              <input className="champ" type="password" name="mot_de_passe" value={form.mot_de_passe} onChange={changer} placeholder="6 caractères minimum" required />
            </div>
            <div>
              <label className="label-champ">Confirmer le mot de passe</label>
              <input className="champ" type="password" name="confirmer" value={form.confirmer} onChange={changer} placeholder="Répétez le mot de passe" required />
            </div>
            <button className="btn btn-primaire" type="submit" disabled={chargement} style={{ padding: '13px 0', fontSize: 14, justifyContent: 'center', marginTop: 8, borderRadius: 10 }}>
              {chargement ? 'Enregistrement…' : 'Confirmer'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
