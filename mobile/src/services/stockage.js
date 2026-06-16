import AsyncStorage from '@react-native-async-storage/async-storage';

export async function sauvegarderSession(token, scanner) {
  await AsyncStorage.multiSet([
    ['token', token],
    ['scanner', JSON.stringify(scanner)],
  ]);
}

export async function chargerSession() {
  const [[, token], [, scannerStr]] = await AsyncStorage.multiGet(['token', 'scanner']);
  return { token, scanner: scannerStr ? JSON.parse(scannerStr) : null };
}

export async function supprimerSession() {
  await AsyncStorage.multiRemove(['token', 'scanner']);
}

// Sauvegarde un scan localement (synchronise ou en_attente)
export async function ajouterScanLocal(scan, syncStatus = 'en_attente') {
  const existants = await chargerScansLocaux();
  const nouveau = { ...scan, sync_status: syncStatus, saved_at: new Date().toISOString() };
  await AsyncStorage.setItem('scans_locaux', JSON.stringify([nouveau, ...existants]));
}

export async function chargerScansLocaux() {
  const data = await AsyncStorage.getItem('scans_locaux');
  return data ? JSON.parse(data) : [];
}

// Retourne uniquement les scans non encore synchronisés
export async function chargerScansEnAttente() {
  const tous = await chargerScansLocaux();
  return tous.filter(s => s.sync_status === 'en_attente');
}

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// Vérifie si le QR code peut être scanné (cooldown 5 min)
// Retourne { autorise: bool, resteSecondes: number }
export async function verifierCooldown(numero) {
  const data = await AsyncStorage.getItem('derniers_scans');
  const derniers = data ? JSON.parse(data) : {};
  const dernierScan = derniers[numero];
  if (!dernierScan) return { autorise: true, resteSecondes: 0 };

  const ecoule = Date.now() - dernierScan;
  if (ecoule >= COOLDOWN_MS) return { autorise: true, resteSecondes: 0 };

  return { autorise: false, resteSecondes: Math.ceil((COOLDOWN_MS - ecoule) / 1000) };
}

export async function enregistrerDernierScan(numero) {
  const data = await AsyncStorage.getItem('derniers_scans');
  const derniers = data ? JSON.parse(data) : {};
  derniers[numero] = Date.now();
  await AsyncStorage.setItem('derniers_scans', JSON.stringify(derniers));
}

// Marque tous les scans en attente comme synchronisés
export async function marquerToutSynchronise() {
  const tous = await chargerScansLocaux();
  const mis = tous.map(s =>
    s.sync_status === 'en_attente' ? { ...s, sync_status: 'synchronise' } : s
  );
  await AsyncStorage.setItem('scans_locaux', JSON.stringify(mis));
}