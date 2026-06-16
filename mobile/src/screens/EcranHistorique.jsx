import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { chargerScansEnAttente } from '../services/stockage';

function formaterDate(d) {
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function EcranHistorique() {
  const [scans, setScans] = useState([]);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    setChargement(true);
    const data = await chargerScansEnAttente();
    setScans([...data].reverse());
    setChargement(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titre}>Scans hors-ligne</Text>
        <Text style={styles.sousTitre}>{scans.length} en attente de synchronisation</Text>
      </View>

      {chargement ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1e40af" /></View>
      ) : scans.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emoji}>✅</Text>
          <Text style={styles.vide}>Aucun scan en attente</Text>
        </View>
      ) : (
        <FlatList
          data={scans}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={chargement} onRefresh={charger} />}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <View style={styles.itemHeader}>
                <Text style={styles.numero}>{item.parapheur_numero}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeTexte}>En attente</Text>
                </View>
              </View>
              <Text style={styles.date}>{formaterDate(item.scanned_at)}</Text>
              <Text style={styles.gps}>
                {item.latitude
                  ? `📍 ${item.latitude.toFixed(4)}° N, ${item.longitude.toFixed(4)}° E`
                  : '📍 GPS non disponible'}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emoji: { fontSize: 48 },
  header: { padding: 20, paddingTop: 50, backgroundColor: '#1e40af' },
  titre: { fontSize: 20, fontWeight: '700', color: 'white' },
  sousTitre: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  vide: { fontSize: 15, color: '#9ca3af' },
  item: {
    backgroundColor: 'white', borderRadius: 12, padding: 16, gap: 6,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  numero: { fontWeight: '700', fontSize: 15, color: '#1e40af' },
  badge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeTexte: { color: '#92400e', fontSize: 11, fontWeight: '600' },
  date: { fontSize: 12, color: '#6b7280' },
  gps: { fontSize: 11, color: '#9ca3af' },
});