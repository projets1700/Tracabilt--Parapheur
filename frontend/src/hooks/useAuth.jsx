import { useState, createContext, useContext } from 'react';
import client from '../api/client';

const ContexteAuth = createContext(null);

export function FournisseurAuth({ children }) {
  const [utilisateur, setUtilisateur] = useState(() => {
    const data = localStorage.getItem('utilisateur');
    return data ? JSON.parse(data) : null;
  });

  async function connexion(email, motDePasse) {
    const { data } = await client.post('/auth/admin/connexion', { email, mot_de_passe: motDePasse });
    localStorage.setItem('token', data.token);
    localStorage.setItem('utilisateur', JSON.stringify(data.utilisateur));
    setUtilisateur(data.utilisateur);
    return data.utilisateur;
  }

  function deconnexion() {
    localStorage.removeItem('token');
    localStorage.removeItem('utilisateur');
    setUtilisateur(null);
  }

  return (
    <ContexteAuth.Provider value={{ utilisateur, connexion, deconnexion }}>
      {children}
    </ContexteAuth.Provider>
  );
}

export function useAuth() {
  return useContext(ContexteAuth);
}