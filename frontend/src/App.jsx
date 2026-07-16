import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PageVisionneur from './pages/PageVisionneur';
import PageInscriptionAdmin from './pages/PageInscriptionAdmin';
import PageConnexionAdmin from './pages/PageConnexionAdmin';
import PageAdmin from './pages/PageAdmin';
import PageListeParapheurs from './pages/PageListeParapheurs';
import PageDetailParapheur from './pages/PageDetailParapheur';
import PageConnexionSuperviseur from './pages/PageConnexionSuperviseur';
import ProtectionSuperviseur from './composants/ProtectionSuperviseur';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/inscription"                  element={<PageInscriptionAdmin />} />
        <Route path="/admin/connexion"                    element={<PageConnexionAdmin />} />
        <Route path="/admin"                              element={<PageAdmin />} />
        <Route path="/superviseur/connexion"              element={<PageConnexionSuperviseur />} />
        <Route path="/parapheurs"                         element={<ProtectionSuperviseur><PageListeParapheurs /></ProtectionSuperviseur>} />
        <Route path="/parapheurs/:numero"                 element={<ProtectionSuperviseur><PageDetailParapheur /></ProtectionSuperviseur>} />
        <Route path="*"                                   element={<PageVisionneur />} />
      </Routes>
    </BrowserRouter>
  );
}