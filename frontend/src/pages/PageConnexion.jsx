import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function PageConnexion() {
  const { connexion } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  async function handleSoumettre(e) {
    e.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      const utilisateur = await connexion(email, motDePasse);
      if (utilisateur.role === 'administrateur') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      setErreur(err.response?.data?.message || 'Identifiants incorrects.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--fond-page)' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 20px' }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, background: 'var(--bleu-clair)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 28 }}>
            📋
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>TraçaParapheur</h1>
          <p style={{ color: 'var(--texte2)', marginTop: 4, fontSize: 13 }}>Connexion administration</p>
        </div>

        <div className="carte" style={{ padding: 24 }}>
          <form onSubmit={handleSoumettre} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label-champ">Email</label>
              <input
                className="champ"
                type="email"
                placeholder="prenom.nom@organisation.fr"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label-champ">Mot de passe</label>
              <input
                className="champ"
                type="password"
                placeholder="••••••••"
                value={motDePasse}
                onChange={e => setMotDePasse(e.target.value)}
                required
              />
            </div>
            {erreur && <div className="message-erreur">{erreur}</div>}
            <button className="btn btn-primaire" type="submit" disabled={envoi} style={{ justifyContent: 'center', padding: 11 }}>
              {envoi ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
          <div className="sep" />
          <div style={{ textAlign: 'center' }}>
            <a href="/" style={{ fontSize: 13, color: 'var(--bleu)', fontWeight: 500 }}>
              ← Retour à la consultation publique
            </a>
          </div>
        </div>

        <div style={{ marginTop: 16, background: 'white', border: '1px solid var(--bordure)', borderRadius: 10, padding: '12px 16px' }}>
          <p style={{ fontSize: 11, color: 'var(--texte3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            Comptes de démo
          </p>
          <p style={{ fontSize: 12, color: 'var(--texte2)' }}><strong>Admin :</strong> admin@organisation.fr / admin123</p>
          <p style={{ fontSize: 12, color: 'var(--texte2)', marginTop: 4 }}><strong>Opérateur :</strong> j.martin@organisation.fr / operateur123</p>
        </div>

      </div>
    </div>
  );
}