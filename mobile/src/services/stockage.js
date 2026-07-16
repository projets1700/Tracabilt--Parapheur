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

// Supprime un scan de l'historique local par son index
export async function supprimerScanLocal(index) {
  const tous = await chargerScansLocaux();
  tous.splice(index, 1);
  await AsyncStorage.setItem('scans_locaux', JSON.stringify(tous));
}

// Retourne uniquement les scans non encore synchronisés
export async function chargerScansEnAttente() {
  const tous = await chargerScansLocaux();
  return tous.filter(s => s.sync_status === 'en_attente');
}

// Marque tous les scans en attente comme synchronisés
export async function marquerToutSynchronise() {
  const tous = await chargerScansLocaux();
  const mis = tous.map(s =>
    s.sync_status === 'en_attente' ? { ...s, sync_status: 'synchronise' } : s
  );
  await AsyncStorage.setItem('scans_locaux', JSON.stringify(mis));
}