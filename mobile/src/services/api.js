import axios from 'axios';
import { getToken } from './stockage';

// Remplace par l'IP de ta machine sur le réseau local pour tester sur téléphone
const BASE_URL = 'http://10.0.2.2:3001/api'; // Android émulateur
// const BASE_URL = 'http://192.168.1.XX:3001/api'; // Vrai téléphone

const client = axios.create({ baseURL: BASE_URL, timeout: 10000 });

client.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function connexionScanner(email, motDePasse) {
  const { data } = await client.post('/auth/scanner/connexion', { email, mot_de_passe: motDePasse });
  return data;
}

export async function envoyerScan(scan) {
  const { data } = await client.post('/evenements/scan', scan);
  return data;
}

export async function synchroniserScans(scans) {
  const { data } = await client.post('/evenements/sync', { scans });
  return data;
}

export async function getMonProfil() {
  const { data } = await client.get('/auth/moi');
  return data;
}