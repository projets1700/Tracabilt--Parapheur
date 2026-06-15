import { useState, useEffect, createContext, useContext } from 'react';
import client from '../api/client';

const ContexteAuth = createContext(null);

export function FournisseurAuth({ children }) {
  const [utilisateur, setUtilisateur] = useState(() => {
    const data = localStorage.getItem('utilisateur');
    return data ? JSON.parse(data) : null;
  });
  const [chargement, setChargement] = useState(false);

  async function connexion(email, motDePasse) {
    setChargement(true);
    try {
      const { data } = await client.post('/auth/connexion', { email, mot_de_passe: motDePasse });
      localStorage.setItem('token', data.token);
      localStorage.setItem('utilisateur', JSON.stringify(data.utilisateur));
      setUtilisateur(data.utilisateur);
      return data.utilisateur;
    } finally {
      setChargement(false);
    }
  }

  function deconnexion() {
    localStorage.removeItem('token');
    localStorage.removeItem('utilisateur');
    setUtilisateur(null);
  }

  return (
    <ContexteAuth.Provider value={{ utilisateur, connexion, deconnexion, chargement }}>
      {children}
    </ContexteAuth.Provider>
  );
}

export function useAuth() {
  return useContext(ContexteAuth);
}
