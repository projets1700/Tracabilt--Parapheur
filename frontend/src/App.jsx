import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PageVisionneur from './pages/PageVisionneur';
import PageConnexion from './pages/PageConnexion';
import PageAdmin from './pages/PageAdmin';
import PageListeParapheurs from './pages/PageListeParapheurs';
import PageDetailParapheur from './pages/PageDetailParapheur';
import ProtectionSuperviseur from './composants/ProtectionSuperviseur';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/connexion"                          element={<PageConnexion />} />
        <Route path="/admin"                              element={<PageAdmin />} />
        <Route path="/parapheurs"                         element={<ProtectionSuperviseur><PageListeParapheurs /></ProtectionSuperviseur>} />
        <Route path="/parapheurs/:numero"                 element={<ProtectionSuperviseur><PageDetailParapheur /></ProtectionSuperviseur>} />
        <Route path="*"                                   element={<PageVisionneur />} />
      </Routes>
    </BrowserRouter>
  );
}