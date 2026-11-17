import { Navigate } from 'react-router-dom';

export default function ProtectionSuperviseur({ children }) {
  if (!localStorage.getItem('superviseur_token')) {
    return <Navigate to="/connexion" replace />;
  }
  return children;
}
