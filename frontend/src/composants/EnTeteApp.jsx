import { NavLink } from 'react-router-dom';
import { utilisateurActif } from '../modules/documents/services/documentsApi';
import '../modules/documents/documents.css';

/**
 * En-tête commun aux espaces connectés : les liens s'adaptent au rôle
 * (administrateur et/ou superviseur).
 */
export default function EnTeteApp() {
  const estAdmin = Boolean(localStorage.getItem('admin_token'));
  const estSuperviseur = Boolean(localStorage.getItem('superviseur_token'));
  const u = utilisateurActif();
  const lienClasse = ({ isActive }) => (isActive ? 'actif' : undefined);

  return (
    <header className="entete-app">
      <NavLink to="/"><img src="/Logo_Parapheur.png" alt="TraçaParapheur" /></NavLink>
      <nav>
        <NavLink to="/" end className={lienClasse}>Recherche</NavLink>
        {estSuperviseur && <NavLink to="/parapheurs" end className={lienClasse}>Parapheurs</NavLink>}
        <NavLink to="/documents" className={lienClasse}>Documents</NavLink>
        {estAdmin && <NavLink to="/admin" className={lienClasse}>Administration</NavLink>}
        {u && (
          <span className="utilisateur">
            <span className="avatar">{(u.nom || u.identifiant || '?').charAt(0).toUpperCase()}</span>
            <span>{u.nom || u.identifiant}</span>
          </span>
        )}
      </nav>
    </header>
  );
}
