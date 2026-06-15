import AsyncStorage from '@react-native-async-storage/async-storage';

const CLES = {
  TOKEN: 'token',
  UTILISATEUR: 'utilisateur',
  SCANS_EN_ATTENTE: 'scans_en_attente',
};

export async function sauvegarderSession(token, utilisateur) {
  await AsyncStorage.multiSet([
    [CLES.TOKEN, token],
    [CLES.UTILISATEUR, JSON.stringify(utilisateur)],
  ]);
}

export async function getToken() {
  return AsyncStorage.getItem(CLES.TOKEN);
}

export async function getUtilisateur() {
  const data = await AsyncStorage.getItem(CLES.UTILISATEUR);
  return data ? JSON.parse(data) : null;
}

export async function supprimerSession() {
  await AsyncStorage.multiRemove([CLES.TOKEN, CLES.UTILISATEUR]);
}

export async function ajouterScanEnAttente(scan) {
  const existants = await getScansEnAttente();
  existants.push({ ...scan, id_local: Date.now().toString() });
  await AsyncStorage.setItem(CLES.SCANS_EN_ATTENTE, JSON.stringify(existants));
}

export async function getScansEnAttente() {
  const data = await AsyncStorage.getItem(CLES.SCANS_EN_ATTENTE);
  return data ? JSON.parse(data) : [];
}

export async function viderScansEnAttente() {
  await AsyncStorage.removeItem(CLES.SCANS_EN_ATTENTE);
}