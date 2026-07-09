import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

function LogoCE() {
  return <img src="/Logo_app.png" alt="CoeurTrace" style={{ width: 300, height: 'auto', objectFit: 'contain' }} />;
}

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
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* Panneau gauche – branding */}
      <div style={{
        flex: '0 0 400px',
        background: 'white',
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
        <p style={{ fontSize: 13, color: 'var(--texte2)', textAlign: 'center', lineHeight: 1.6 }}>Première configuration{'\n'}du compte administrateur</p>
      </div>

      {/* Panneau droit – formulaire */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F7FA', padding: 40, overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1D1D1B', marginBottom: 6 }}>Créer le compte admin</h1>
          <p style={{ fontSize: 13, color: 'var(--texte2)', marginBottom: 32 }}>Ce compte sera le seul administrateur du système.</p>

          {erreur && <div className="message-erreur" style={{ marginBottom: 20 }}>{erreur}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label-champ">Nom complet</label>
              <input className="champ" name="nom" value={form.nom} onChange={changer} placeholder="Ex : Marie Dupont" autoFocus required />
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
            <button
              className="btn btn-primaire"
              type="submit"
              disabled={chargement}
              style={{ padding: '13px 0', fontSize: 14, justifyContent: 'center', marginTop: 8, borderRadius: 10 }}
            >
              {chargement ? 'Création…' : 'Créer le compte'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
