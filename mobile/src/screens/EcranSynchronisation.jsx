import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { api } from '../services/api';
import { chargerScansEnAttente, marquerToutSynchronise } from '../services/stockage';
import { theme } from '../theme';

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
      await marquerToutSynchronise();
      setScansEnAttente([]);
      Alert.alert('Succès', `${scansEnAttente.length} scan(s) synchronisé(s) !`);
    } catch (err) {
      Alert.alert('Erreur', err.message || 'Vérifiez votre connexion réseau.');
    } finally {
      setSyncing(false);
    }
  }

  if (chargement) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.teal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image source={require('../../assets/Logo_app.png')} style={styles.logo} />
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
              ? <ActivityIndicator color={theme.blanc} />
              : <Text style={styles.boutonTexte}>🔄 Synchroniser maintenant</Text>
            }
          </TouchableOpacity>
        ) : (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 52 }}>✅</Text>
            <Text style={{ fontSize: 18, color: theme.texteFonce, fontWeight: '500' }}>Tout est synchronisé</Text>
          </View>
        )}

        <TouchableOpacity onPress={charger} style={{ padding: 12 }}>
          <Text style={{ color: theme.placeholder, fontSize: 14 }}>Actualiser</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.fond },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.fond },
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: theme.blanc,
    borderBottomWidth: 1,
    borderBottomColor: theme.bordure,
  },
  logo: { width: 140, height: 50, resizeMode: 'contain', marginBottom: 10 },
  titre: { fontSize: 20, fontWeight: '700', color: theme.bleu },
  contenu: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24, padding: 32 },
  compteur: {
    alignItems: 'center',
    backgroundColor: theme.fondClair,
    borderRadius: 16,
    padding: 32,
    width: '100%',
    borderWidth: 1,
    borderColor: theme.bordure,
  },
  compteurNombre: { fontSize: 72, fontWeight: '700', color: theme.teal },
  compteurLabel: { fontSize: 16, color: theme.texte, marginTop: 4 },
  bouton: { backgroundColor: theme.teal, borderRadius: 10, padding: 18, alignItems: 'center', width: '100%' },
  boutonTexte: { color: theme.blanc, fontWeight: '700', fontSize: 16 },
});
