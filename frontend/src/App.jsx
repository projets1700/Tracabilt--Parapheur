import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PageVisionneur from './pages/PageVisionneur';
import PageInscriptionAdmin from './pages/PageInscriptionAdmin';
import PageConnexionAdmin from './pages/PageConnexionAdmin';
import PageAdmin from './pages/PageAdmin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/inscription" element={<PageInscriptionAdmin />} />
        <Route path="/admin/connexion"   element={<PageConnexionAdmin />} />
        <Route path="/admin"             element={<PageAdmin />} />
        <Route path="*"                  element={<PageVisionneur />} />
      </Routes>
    </BrowserRouter>
  );
}