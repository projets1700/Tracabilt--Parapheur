import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { getPosition } from '../services/gps';
import { envoyerScan } from '../services/api';
import { ajouterScanEnAttente } from '../services/stockage';

export default function EcranScanner({ navigation, route }) {
  const { utilisateur } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [traitement, setTraitement] = useState(false);
  const deja_scanne = useRef(false);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  async function handleScan({ data: qrData }) {
    if (deja_scanne.current || traitement) return;
    deja_scanne.current = true;
    setTraitement(true);

    try {
      const reference = qrData.trim().toUpperCase();
      const position = await getPosition();

      const scan = {
        parapheur_reference: reference,
        latitude: position?.latitude || null,
        longitude: position?.longitude || null,
        precision_gps: position?.precision_gps || null,
        localisation_nom: null,
        identifiant_appareil: utilisateur.id,
        date_scan: new Date().toISOString(),
      };

      let succes = false;
      try {
        await envoyerScan(scan);
        succes = true;
      } catch {
        await ajouterScanEnAttente(scan);
      }

      navigation.replace('ScanReussi', { reference, position, succes, utilisateur });
    } catch (err) {
      Alert.alert('Erreur', 'Une erreur est survenue lors du scan.');
      deja_scanne.current = false;
      setTraitement(false);
    }
  }

  if (!permission) return <View style={styles.conteneur} />;

  if (!permission.granted) {
    return (
      <View style={styles.conteneur}>
        <Text style={styles.message}>La caméra est nécessaire pour scanner les QR codes.</Text>
        <TouchableOpacity style={styles.btnPermission} onPress={requestPermission}>
          <Text style={styles.txtPermission}>Autoriser la caméra</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.conteneur}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={traitement ? undefined : handleScan}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
      <View style={styles.overlay}>
        <Text style={styles.instruction}>Pointez la caméra vers le QR code</Text>
        <View style={styles.cadre} />
        {traitement && <Text style={styles.traitement}>Traitement en cours…</Text>}
      </View>
      <TouchableOpacity style={styles.btnRetour} onPress={() => navigation.goBack()}>
        <Text style={styles.txtRetour}>✕ Annuler</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  message: { color: 'white', textAlign: 'center', margin: 24, fontSize: 15 },
  btnPermission: { backgroundColor: '#185FA5', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  txtPermission: { color: 'white', fontWeight: '600' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  instruction: { color: 'white', fontSize: 15, marginBottom: 32, textAlign: 'center', paddingHorizontal: 24 },
  cadre: { width: 240, height: 240, borderWidth: 2, borderColor: 'white', borderRadius: 16 },
  traitement: { color: 'white', marginTop: 24, fontSize: 14 },
  btnRetour: { position: 'absolute', top: 56, left: 20, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  txtRetour: { color: 'white', fontSize: 14 },
});