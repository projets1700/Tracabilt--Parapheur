import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FournisseurAuth, useAuth } from './hooks/useAuth.jsx';
import PageConnexion from './pages/PageConnexion';
import PageVisionneur from './pages/PageVisionneur';

function RouteAdmin({ enfants }) {
  const { utilisateur } = useAuth();
  if (!utilisateur) return <Navigate to="/connexion" replace />;
  if (utilisateur.role !== 'administrateur') return <Navigate to="/" replace />;
  return enfants;
}

function AppContenu() {
  return (
    <Routes>
      <Route path="/" element={<PageVisionneur />} />
      <Route path="/connexion" element={<PageConnexion />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <FournisseurAuth>
      <BrowserRouter>
        <AppContenu />
      </BrowserRouter>
    </FournisseurAuth>
  );
}