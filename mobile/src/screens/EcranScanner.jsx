import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { api } from '../services/api';
import { demanderPermissions, obtenirPosition } from '../services/gps';
import { ajouterScanLocal, chargerScansLocaux } from '../services/stockage';

const COOLDOWN_MS = 5 * 60 * 1000;
const COOLDOWN_KEY = 'cooldown_scans';

function distanceMetres(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Cherche un lieu déjà connu dans l'historique local pour ces coordonnées GPS (rayon 100 m)
function trouverLieuPourCoords(coords, historique) {
  if (coords.latitude == null || coords.longitude == null) return null;
  for (const scan of historique) {
    if (scan.lieu?.nom_lieu && scan.latitude != null && scan.longitude != null) {
      if (distanceMetres(coords.latitude, coords.longitude, parseFloat(scan.latitude), parseFloat(scan.longitude)) <= 100) {
        return scan.lieu.nom_lieu;
      }
    }
  }
  return null;
}

export default function EcranScanner({ scanner, onDeconnexion }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [saisieLieu, setSaisieLieu] = useState(null); // { numero, coords } — étape saisie lieu
  const [lieuInput, setLieuInput] = useState('');
  const [resultat, setResultat] = useState(null);
  const enTraitement = useRef(false);

  async function handleBarcode({ data }) {
    if (enTraitement.current) return;
    enTraitement.current = true;

    const numero = data.trim().toUpperCase();

    // Vérification cooldown 5 minutes
    const raw = await AsyncStorage.getItem(COOLDOWN_KEY).catch(() => null);
    const cooldowns = raw ? JSON.parse(raw) : {};
    if (cooldowns[numero] && Date.now() - cooldowns[numero] < COOLDOWN_MS) {
      const resteMs = COOLDOWN_MS - (Date.now() - cooldowns[numero]);
      const min = Math.floor(resteMs / 60000);
      const sec = Math.ceil((resteMs % 60000) / 1000);
      const duree = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
      Alert.alert(
        'QR Code déjà scanné',
        `Veuillez attendre ${duree} avant de scanner de nouveau ce QR code.`,
        [{ text: 'OK', onPress: () => { enTraitement.current = false; } }],
        { cancelable: false }
      );
      return;
    }

    // Enregistre le timestamp du cooldown
    cooldowns[numero] = Date.now();
    await AsyncStorage.setItem(COOLDOWN_KEY, JSON.stringify(cooldowns)).catch(() => {});

    // Récupère les coordonnées GPS
    setScanning(true);
    let coords = { latitude: null, longitude: null, precision_gps: null };
    try {
      const hasGps = await demanderPermissions();
      if (hasGps) {
        try { coords = await obtenirPosition(); } catch {}
      }
    } catch {}
    setScanning(false);

    // Si les coordonnées correspondent à un lieu déjà connu → scan direct, pas de modal
    const historique = await chargerScansLocaux().catch(() => []);
    const lieuConnu = trouverLieuPourCoords(coords, historique);
    if (lieuConnu) {
      await soumettreAvecLieu(lieuConnu, { numero, coords });
      return;
    }

    // Nouvelles coordonnées (ou pas de GPS) → modal de saisie
    setLieuInput('');
    setSaisieLieu({ numero, coords });
  }

  async function soumettreAvecLieu(nomLieu, saisieData) {
    const { numero, coords } = saisieData ?? saisieLieu;
    setSaisieLieu(null);

    const lieu = nomLieu.trim() ? { nom_lieu: nomLieu.trim() } : null;
    const scanData = {
      parapheur_numero: numero,
      latitude: coords.latitude,
      longitude: coords.longitude,
      precision_gps: coords.precision_gps,
      lieu,
      scanned_at: new Date().toISOString(),
    };

    setScanning(true);
    try {
      await api.enregistrerScan(scanData);
      // Ne pas laisser une erreur de stockage local masquer le succès serveur
      try { await ajouterScanLocal(scanData, 'synchronise'); } catch {}
      setResultat({
        succes: true,
        numero,
        message: lieu ? `Scan enregistré — ${lieu.nom_lieu}` : 'Scan enregistré avec succès !',
      });
    } catch (err) {
      const estErreurReseau =
        !err?.message || err.message === 'Network request failed' || err.message.includes('fetch');
      if (estErreurReseau) {
        try { await ajouterScanLocal(scanData, 'en_attente'); } catch {}
        setResultat({ succes: false, horsligne: true, numero, message: 'Hors-ligne — scan sauvegardé localement.' });
      } else {
        setResultat({ succes: false, numero, message: err?.message || 'Erreur inconnue.' });
      }
    } finally {
      setScanning(false);
      setTimeout(() => { enTraitement.current = false; }, 3000);
    }
  }

  function annulerSaisie() {
    setSaisieLieu(null);
    enTraitement.current = false;
  }

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1e40af" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.texteGris}>Accès à la caméra requis pour scanner</Text>
        <TouchableOpacity style={styles.bouton} onPress={requestPermission}>
          <Text style={styles.boutonTexte}>Autoriser la caméra</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerNom}>👤 {scanner?.nom}</Text>
        <TouchableOpacity onPress={onDeconnexion}>
          <Text style={styles.headerDeconnexion}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanning || saisieLieu || resultat ? undefined : handleBarcode}
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8'] }}
      />

      <View style={styles.overlayBas}>
        {scanning
          ? <ActivityIndicator color="white" size="large" />
          : <Text style={styles.instruction}>Pointez vers un QR code ou code-barres</Text>
        }
      </View>

      {/* Modal saisie du lieu */}
      {saisieLieu && (
        <Modal transparent animationType="slide" onRequestClose={annulerSaisie}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalEmoji}>📍</Text>
              <Text style={styles.modalNumero}>{saisieLieu.numero}</Text>
              <Text style={styles.modalMessage}>Saisissez le lieu du scan</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex : Bureau 302, Salle de réunion..."
                placeholderTextColor="#9ca3af"
                value={lieuInput}
                onChangeText={setLieuInput}
                autoFocus
                selectTextOnFocus
                returnKeyType="done"
                onSubmitEditing={() => soumettreAvecLieu(lieuInput)}
              />
              <TouchableOpacity style={styles.bouton} onPress={() => soumettreAvecLieu(lieuInput)}>
                <Text style={styles.boutonTexte}>Confirmer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.boutonSecondaire} onPress={() => soumettreAvecLieu('')}>
                <Text style={styles.boutonSecondaireTexte}>Passer (sans lieu)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal résultat */}
      {resultat && (
        <Modal transparent animationType="slide" onRequestClose={() => setResultat(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalEmoji}>
                {resultat.succes ? '✅' : resultat.horsligne ? '💾' : '❌'}
              </Text>
              <Text style={styles.modalNumero}>{resultat.numero}</Text>
              <Text style={styles.modalMessage}>{resultat.message}</Text>
              <TouchableOpacity style={styles.bouton} onPress={() => setResultat(null)}>
                <Text style={styles.boutonTexte}>Scanner un autre</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, backgroundColor: '#f9fafb', padding: 32 },
  texteGris: { fontSize: 16, color: '#374151', textAlign: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 50, backgroundColor: '#1e40af',
  },
  headerNom: { color: 'white', fontWeight: '600', fontSize: 15 },
  headerDeconnexion: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  camera: { flex: 1 },
  overlayBas: { padding: 28, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center' },
  instruction: { color: 'white', fontSize: 14, textAlign: 'center' },
  bouton: { backgroundColor: '#1e40af', borderRadius: 12, padding: 16, alignItems: 'center', width: '100%' },
  boutonTexte: { color: 'white', fontWeight: '700', fontSize: 15 },
  boutonSecondaire: { padding: 12, alignItems: 'center' },
  boutonSecondaireTexte: { color: '#6b7280', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 32, alignItems: 'center', gap: 12,
  },
  modalEmoji: { fontSize: 48 },
  modalNumero: { fontSize: 18, fontWeight: '700', color: '#1e40af' },
  modalMessage: { fontSize: 14, color: '#374151', textAlign: 'center' },
  input: {
    width: '100%', borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 10,
    padding: 14, fontSize: 15, color: '#111827', backgroundColor: '#f9fafb',
  },
});