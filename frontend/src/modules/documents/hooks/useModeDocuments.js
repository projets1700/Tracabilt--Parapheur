import { useEffect, useState } from 'react';
import { detecterMode } from '../services/documentsApi';

/** Mode de fonctionnement du module : « serveur » ou « local ». */
export default function useModeDocuments() {
  const [mode, setMode] = useState(null);
  useEffect(() => {
    let actif = true;
    detecterMode().then(m => actif && setMode(m));
    return () => { actif = false; };
  }, []);
  return mode;
}
