import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PageVisionneur from './pages/PageVisionneur';
import PageConnexion from './pages/PageConnexion';
import PageAdmin from './pages/PageAdmin';
import PageListeParapheurs from './pages/PageListeParapheurs';
import PageDetailParapheur from './pages/PageDetailParapheur';
import ProtectionSuperviseur from './composants/ProtectionSuperviseur';

// Module documentaire chargé à la demande (pdf.js, Konva, pdf-lib).
const PageDocuments = lazy(() => import('./modules/documents/pages/PageDocuments'));
const PageEditeurDocument = lazy(() => import('./modules/documents/pages/PageEditeurDocument'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="chargement">Chargement…</div>}>
      <Routes>
        <Route path="/connexion"                          element={<PageConnexion />} />
        <Route path="/admin"                              element={<PageAdmin />} />
        <Route path="/parapheurs"                         element={<ProtectionSuperviseur><PageListeParapheurs /></ProtectionSuperviseur>} />
        <Route path="/parapheurs/:numero"                 element={<ProtectionSuperviseur><PageDetailParapheur /></ProtectionSuperviseur>} />
        {/* Accessibles sans connexion : un visiteur travaille dans son navigateur,
            un utilisateur connecté utilise le serveur documentaire. */}
        <Route path="/documents"                          element={<PageDocuments />} />
        <Route path="/documents/:id"                      element={<PageEditeurDocument />} />
        <Route path="*"                                   element={<PageVisionneur />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}