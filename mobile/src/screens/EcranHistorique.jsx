import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { chargerScansLocaux } from '../services/stockage';
import { synchroniserScansEnAttente } from '../services/sync';
import { theme } from '../theme';

function formaterDate(d) {
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function EcranHistorique() {
  const [scans, setScans] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [synchronisation, setSynchronisation] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    const data = await chargerScansLocaux();
    setScans(data);
    setChargement(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const enAttente = scans.filter(s => s.sync_status === 'en_attente').length;

  async function handleSynchroniser() {
    setSynchronisation(true);
    try {
      const nombre = await synchroniserScansEnAttente();
      await charger();
      Alert.alert('Synchronisation', nombre > 0 ? `${nombre} scan(s) synchronisé(s).` : 'Rien à synchroniser.');
    } catch {
      Alert.alert('Synchronisation échouée', 'Vérifiez votre connexion et réessayez.');
    } finally {
      setSynchronisation(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.titre}>Historique des scans</Text>
          <TouchableOpacity onPress={handleSynchroniser} disabled={synchronisation}>
            {synchronisation ? (
              <ActivityIndicator size="small" color={theme.bleu} />
            ) : (
              <Text style={styles.lienSync}>🔄 Synchroniser</Text>
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.sousTitre}>
          {scans.length} scan(s) · {enAttente} en attente de sync
        </Text>
      </View>

      {chargement ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.teal} /></View>
      ) : scans.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emoji}>📋</Text>
          <Text style={styles.vide}>Aucun scan enregistré</Text>
        </View>
      ) : (
        <FlatList
          data={scans}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={chargement} onRefresh={charger} tintColor={theme.teal} />}
          renderItem={({ item }) => {
            const estSync = item.sync_status === 'synchronise';
            return (
              <View style={styles.item}>
                <View style={styles.itemHeader}>
                  <Text style={styles.numero}>{item.parapheur_numero}</Text>
                  <View style={[styles.badge, estSync ? styles.badgeVert : styles.badgeOrange]}>
                    <Text style={[styles.badgeTexte, estSync ? styles.badgeTexteVert : styles.badgeTexteOrange]}>
                      {estSync ? '✓ Synchronisé' : '⏳ En attente'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.date}>{formaterDate(item.scanned_at)}</Text>
                <Text style={styles.gps}>
                  {item.lieu?.nom_lieu
                    ? `📍 ${item.lieu.nom_lieu}`
                    : item.latitude != null
                      ? `📍 ${parseFloat(item.latitude).toFixed(4)}° N, ${parseFloat(item.longitude).toFixed(4)}° E`
                      : '📍 GPS non disponible'}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.fond },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emoji: { fontSize: 48 },
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: theme.vertBandeau,
    borderBottomWidth: 1,
    borderBottomColor: theme.bordure,
  },
  titre: { fontSize: 20, fontWeight: '700', color: theme.bleu },
  lienSync: { fontSize: 13, fontWeight: '600', color: theme.teal },
  sousTitre: { fontSize: 13, color: theme.texte, marginTop: 4 },
  vide: { fontSize: 15, color: theme.placeholder },
  item: {
    backgroundColor: theme.blanc,
    borderRadius: 12,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.bordure,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  numero: { fontWeight: '700', fontSize: 15, color: theme.teal },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeVert: { backgroundColor: theme.vertClair },
  badgeOrange: { backgroundColor: theme.orangeClair },
  badgeTexte: { fontSize: 11, fontWeight: '600' },
  badgeTexteVert: { color: theme.vertFonce },
  badgeTexteOrange: { color: theme.orangeFonce },
  date: { fontSize: 12, color: theme.texte },
  gps: { fontSize: 11, color: theme.placeholder },
});
