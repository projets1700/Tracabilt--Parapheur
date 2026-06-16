import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { api } from '../services/api';
import { demanderPermissions, obtenirPosition } from '../services/gps';
import { ajouterScanLocal, verifierCooldown, enregistrerDernierScan } from '../services/stockage';

export default function EcranScanner({ scanner, onDeconnexion }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [resultat, setResultat] = useState(null);
  const cooldown = useRef(false);

  async function handleBarcode({ data }) {
    if (cooldown.current || scanning) return;
    cooldown.current = true;
    setScanning(true);

    try {
      const numero = data.trim().toUpperCase();

      // Vérification cooldown 5 minutes
      const { autorise, resteSecondes } = await verifierCooldown(numero);
      if (!autorise) {
        const min = Math.floor(resteSecondes / 60);
        const sec = resteSecondes % 60;
        const duree = min > 0 ? `${min}m${sec > 0 ? ` ${sec}s` : ''}` : `${sec}s`;
        setResultat({ success: false, numero, message: `Ce parapheur a déjà été scanné. Réessayez dans ${duree}.` });
        setScanning(false);
        setTimeout(() => { cooldown.current = false; }, 3000);
        return;
      }

      let coords = { latitude: null, longitude: null, precision_gps: null };
      const hasGps = await demanderPermissions();
      if (hasGps) {
        try { coords = await obtenirPosition(); } catch {}
      }

      const scanData = {
        parapheur_numero: numero,
        latitude: coords.latitude,
        longitude: coords.longitude,
        precision_gps: coords.precision_gps,
        scanned_at: new Date().toISOString(),
      };

      try {
        await api.enregistrerScan(scanData);
        await ajouterScanLocal(scanData, 'synchronise');
        await enregistrerDernierScan(numero);
        setResultat({ success: true, numero, message: 'Scan enregistré avec succès !' });
      } catch (err) {
        // Erreur réseau → sauvegarder hors-ligne
        // Erreur API (4xx) → afficher le message, ne pas sauvegarder
        const estErreurReseau = !err.message || err.message === 'Network request failed' || err.message.includes('fetch');
        if (estErreurReseau) {
          await ajouterScanLocal(scanData, 'en_attente');
          await enregistrerDernierScan(numero);
          setResultat({ success: false, numero, message: 'Hors-ligne — scan sauvegardé localement.' });
        } else {
          setResultat({ success: false, numero, message: err.message });
        }
      }
    } finally {
      setScanning(false);
      setTimeout(() => { cooldown.current = false; }, 3000);
    }
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
        onBarcodeScanned={scanning ? undefined : handleBarcode}
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8'] }}
      />

      <View style={styles.overlayBas}>
        {scanning
          ? <ActivityIndicator color="white" size="large" />
          : <Text style={styles.instruction}>Pointez vers un QR code ou code-barres</Text>
        }
      </View>

      {resultat && (
        <Modal transparent animationType="slide" onRequestClose={() => setResultat(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalEmoji}>{resultat.success ? '✅' : '💾'}</Text>
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
  bouton: { backgroundColor: '#1e40af', borderRadius: 12, padding: 16, alignItems: 'center', minWidth: 220 },
  boutonTexte: { color: 'white', fontWeight: '700', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 32, alignItems: 'center', gap: 12,
  },
  modalEmoji: { fontSize: 52 },
  modalNumero: { fontSize: 18, fontWeight: '700', color: '#1e40af' },
  modalMessage: { fontSize: 14, color: '#374151', textAlign: 'center' },
});