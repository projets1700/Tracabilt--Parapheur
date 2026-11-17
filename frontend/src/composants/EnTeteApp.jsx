import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { utilisateurActif } from '../modules/documents/services/documentsApi';
import '../modules/documents/documents.css';

/**
 * En-tête des pages Documents, au même style que le reste de l'application
 * (bandeau vert) : liens selon le rôle, puis connexion / déconnexion.
 */
export default function EnTeteApp() {
  const navigate = useNavigate();
  const [utilisateur, setUtilisateur] = useState(utilisateurActif);
  const estAdmin = utilisateur?.role === 'admin';
  const estSuperviseur = utilisateur?.role === 'superviseur';
  const lienClasse = ({ isActive }) => (isActive ? 'actif' : undefined);

  function deconnecter() {
    ['admin_token', 'admin_user', 'superviseur_token', 'superviseur_user'].forEach(c => localStorage.removeItem(c));
    setUtilisateur(null);
    navigate('/');
  }

  return (
    <header className="entete-app">
      <Link to="/"><img src="/Logo_Parapheur.png" alt="CoeurTrace" /></Link>
      <nav>
        <NavLink to="/" end className={lienClasse}>Recherche</NavLink>
        {estSuperviseur && <NavLink to="/parapheurs" end className={lienClasse}>Parapheurs</NavLink>}
        <NavLink to="/documents" className={lienClasse}>Documents</NavLink>
        {estAdmin && <NavLink to="/admin" className={lienClasse}>Administration</NavLink>}
        {utilisateur ? (
          <>
            <span className="utilisateur">Connecté : {utilisateur.nom || utilisateur.identifiant}</span>
            <button className="btn btn-primaire btn-petit" onClick={deconnecter}>Déconnexion</button>
          </>
        ) : (
          <Link to="/connexion" className="btn btn-primaire btn-petit">Connexion</Link>
        )}
      </nav>
    </header>
  );
}
