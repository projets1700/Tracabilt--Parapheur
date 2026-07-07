import AsyncStorage from '@react-native-async-storage/async-storage';

// IP du PC sur le réseau WiFi — à changer si besoin
export const BACKEND_URL = 'http://51.38.129.2:3001/api';

async function fetchApi(path, options = {}) {
  const token = await AsyncStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${BACKEND_URL}${path}`, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Erreur serveur');
  return data;
}

export const api = {
  connexionScanner: (identifiant, mot_de_passe) =>
    fetchApi('/auth/scanner/connexion', {
      method: 'POST',
      body: JSON.stringify({ identifiant, mot_de_passe }),
    }),

  enregistrerScan: (scan) =>
    fetchApi('/scans', { method: 'POST', body: JSON.stringify(scan) }),

  synchroniserScans: (scans) =>
    fetchApi('/scans/sync', { method: 'POST', body: JSON.stringify({ scans }) }),
};