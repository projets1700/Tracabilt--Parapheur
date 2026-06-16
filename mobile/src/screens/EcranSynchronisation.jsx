import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { api } from '../services/api';
import { chargerScansEnAttente, viderScansEnAttente } from '../services/stockage';

export default function EcranSynchronisation() {
  const [scansEnAttente, setScansEnAttente] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    setChargement(true);
    const data = await chargerScansEnAttente();
    setScansEnAttente(data);
    setChargement(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  async function handleSync() {
    if (scansEnAttente.length === 0) return;
    setSyncing(true);
    try {
      await api.synchroniserScans(scansEnAttente);
      await viderScansEnAttente();
      setScansEnAttente([]);
      Alert.alert('Succès', `${scansEnAttente.length} scan(s) synchronisé(s) !`);
    } catch (err) {
      Alert.alert('Erreur', err.message || 'Vérifiez votre connexion réseau.');
    } finally {
      setSyncing(false);
    }
  }

  if (chargement) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1e40af" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titre}>Synchronisation</Text>
      </View>

      <View style={styles.contenu}>
        <View style={styles.compteur}>
          <Text style={styles.compteurNombre}>{scansEnAttente.length}</Text>
          <Text style={styles.compteurLabel}>scan(s) en attente</Text>
        </View>

        {scansEnAttente.length > 0 ? (
          <TouchableOpacity
            style={[styles.bouton, syncing && { opacity: 0.6 }]}
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing
              ? <ActivityIndicator color="white" />
              : <Text style={styles.boutonTexte}>🔄 Synchroniser maintenant</Text>
            }
          </TouchableOpacity>
        ) : (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 52 }}>✅</Text>
            <Text style={{ fontSize: 18, color: '#374151', fontWeight: '500' }}>Tout est synchronisé</Text>
          </View>
        )}

        <TouchableOpacity onPress={charger} style={{ padding: 12 }}>
          <Text style={{ color: '#9ca3af', fontSize: 14 }}>Actualiser</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingTop: 50, backgroundColor: '#1e40af' },
  titre: { fontSize: 20, fontWeight: '700', color: 'white' },
  contenu: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24, padding: 32 },
  compteur: {
    alignItems: 'center', backgroundColor: 'white', borderRadius: 16, padding: 32,
    width: '100%', elevation: 3,
  },
  compteurNombre: { fontSize: 72, fontWeight: '700', color: '#1e40af' },
  compteurLabel: { fontSize: 16, color: '#6b7280', marginTop: 4 },
  bouton: { backgroundColor: '#1e40af', borderRadius: 12, padding: 18, alignItems: 'center', width: '100%' },
  boutonTexte: { color: 'white', fontWeight: '700', fontSize: 16 },
});