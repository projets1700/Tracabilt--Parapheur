import { useCallback, useState } from 'react';

const LIMITE = 100;

/**
 * Pile d'annulation / rétablissement (§3.4) pour l'état de l'éditeur.
 */
export default function useAnnulation(initial) {
  const [pile, setPile] = useState({ passe: [], present: initial, futur: [] });

  const definir = useCallback(miseAJour => {
    setPile(p => {
      const suivant = typeof miseAJour === 'function' ? miseAJour(p.present) : miseAJour;
      if (suivant === p.present) return p;
      return { passe: [...p.passe, p.present].slice(-LIMITE), present: suivant, futur: [] };
    });
  }, []);

  const annuler = useCallback(() => {
    setPile(p => p.passe.length
      ? { passe: p.passe.slice(0, -1), present: p.passe[p.passe.length - 1], futur: [p.present, ...p.futur] }
      : p);
  }, []);

  const retablir = useCallback(() => {
    setPile(p => p.futur.length
      ? { passe: [...p.passe, p.present], present: p.futur[0], futur: p.futur.slice(1) }
      : p);
  }, []);

  const reinitialiser = useCallback(valeur => {
    setPile({ passe: [], present: valeur, futur: [] });
  }, []);

  /**
   * Applique une transformation à TOUS les états (passés, présent, futurs), sans
   * créer d'entrée d'annulation. Sert aux changements déjà enregistrés côté serveur
   * (ex. renommage d'un QR code) qu'une annulation ne doit pas défaire.
   */
  const transformerTout = useCallback(fn => {
    setPile(p => ({ passe: p.passe.map(fn), present: fn(p.present), futur: p.futur.map(fn) }));
  }, []);

  return {
    etat: pile.present,
    definir,
    annuler,
    retablir,
    reinitialiser,
    transformerTout,
    peutAnnuler: pile.passe.length > 0,
    peutRetablir: pile.futur.length > 0,
  };
}
