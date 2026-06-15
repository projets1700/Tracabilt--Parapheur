import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FournisseurAuth, useAuth } from './hooks/useAuth';
import PageConnexion from './pages/PageConnexion';
import PageVisionneur from './pages/PageVisionneur';
import PageDashboard from './pages/admin/PageDashboard';
import PageTrajets from './pages/admin/PageTrajets';
import PageUtilisateurs from './pages/admin/PageUtilisateurs';
import PageEvenements from './pages/admin/PageEvenements';
import MiseEnPageAdmin from './components/MiseEnPageAdmin';

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
      <Route path="/admin" element={
        <RouteAdmin>
          <MiseEnPageAdmin />
        </RouteAdmin>
      }>
        <Route index element={<PageDashboard />} />
        <Route path="trajets" element={<PageTrajets />} />
        <Route path="utilisateurs" element={<PageUtilisateurs />} />
        <Route path="evenements" element={<PageEvenements />} />
      </Route>
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
