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

export async function ajouterScanEnAttente(scan) {
  const existants = await chargerScansEnAttente();
  await AsyncStorage.setItem('scans_en_attente', JSON.stringify([...existants, scan]));
}

export async function chargerScansEnAttente() {
  const data = await AsyncStorage.getItem('scans_en_attente');
  return data ? JSON.parse(data) : [];
}

export async function viderScansEnAttente() {
  await AsyncStorage.removeItem('scans_en_attente');
}