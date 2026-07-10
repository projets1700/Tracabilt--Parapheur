import AsyncStorage from '@react-native-async-storage/async-storage';

export const BACKEND_URL = 'http://51.38.129.2:3001/api';

async function fetchApi(path, options = {}) {
  try {
    const token = await AsyncStorage.getItem('token');

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const url = `${BACKEND_URL}${path}`;
    console.log('API URL:', url);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const text = await response.text();
    console.log('API STATUS:', response.status);
    console.log('API RESPONSE:', text);

    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error('Réponse serveur non JSON : ' + text);
    }

    if (!response.ok) {
      throw new Error(data.message || 'Erreur serveur');
    }

    return data;
  } catch (error) {
    console.log('FETCH ERROR:', error);
    console.log('FETCH MESSAGE:', error.message);
    throw new Error(error.message || 'Erreur réseau.');
  }
}

export const api = {
  testSante: () => fetchApi('/sante'),

  connexionScanner: (identifiant, mot_de_passe) =>
    fetchApi('/auth/scanner/connexion', {
      method: 'POST',
      body: JSON.stringify({ identifiant, mot_de_passe }),
    }),

  enregistrerScan: (scan) =>
    fetchApi('/scans', {
      method: 'POST',
      body: JSON.stringify(scan),
    }),

  synchroniserScans: (scans) =>
    fetchApi('/scans/sync', {
      method: 'POST',
      body: JSON.stringify({ scans }),
    }),
};
