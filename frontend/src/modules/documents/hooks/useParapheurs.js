import { useEffect, useState } from 'react';
import { listerParapheurs } from '../services/documentsApi';

let cache = null;

/** Liste des parapheurs existants, chargée une seule fois et partagée. */
export default function useParapheurs() {
  const [etat, setEtat] = useState({ liste: cache?.liste || [], chargement: !cache?.liste, erreur: '' });

  useEffect(() => {
    if (!cache) {
      cache = { promesse: listerParapheurs().then(liste => { cache.liste = liste; return liste; }) };
      cache.promesse.catch(() => { cache = null; });
    }
    let actif = true;
    cache.promesse
      .then(liste => actif && setEtat({ liste, chargement: false, erreur: '' }))
      .catch(() => actif && setEtat({ liste: [], chargement: false, erreur: 'Impossible de charger les parapheurs.' }));
    return () => { actif = false; };
  }, []);

  return etat;
}
