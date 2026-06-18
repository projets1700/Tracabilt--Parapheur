import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PageVisionneur from './pages/PageVisionneur';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<PageVisionneur />} />
      </Routes>
    </BrowserRouter>
  );
}