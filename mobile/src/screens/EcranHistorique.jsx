import { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getScansEnAttente } from '../services/stockage';

function formaterDate(d) {
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function EcranHistorique({ navigation }) {
  const [scans, setScans] = useState([]);

  useFocusEffect(
    useCallback(() => {
      getScansEnAttente().then(setScans);
    }, [])
  );

  if (scans.length === 0) {
    return (
      <View style={styles.vide}>
        <Text style={styles.videIcone}>📋</Text>
        <Text style={styles.videTexte}>Aucun scan en attente</Text>
        <Text style={styles.videSSTexte}>Les scans non synchronisés apparaissent ici</Text>
        <TouchableOpacity style={styles.btnRetour} onPress={() => navigation.goBack()}>
          <Text style={styles.txtRetour}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.conteneur}>
      <Text style={styles.titre}>Historique local</Text>
      <Text style={styles.sousTitre}>{scans.length} scan{scans.length > 1 ? 's' : ''} en attente de synchronisation</Text>
      <FlatList
        data={[...scans].reverse()}
        keyExtractor={item => item.id_local}
        contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
        renderItem={({ item }) => (
          <View style={styles.carte}>
            <View style={styles.carteEntete}>
              <Text style={styles.reference}>{item.parapheur_reference}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeTexte}>En attente</Text>
              </View>
            </View>
            <Text style={styles.date}>{formaterDate(item.date_scan)}</Text>
            {item.latitude && (
              <Text style={styles.gps}>
                GPS : {parseFloat(item.latitude).toFixed(4)}, {parseFloat(item.longitude).toFixed(4)}
              </Text>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: '#F5F5F0', padding: 24 },
  titre: { fontSize: 22, fontWeight: '700', marginTop: 20 },
  sousTitre: { fontSize: 13, color: '#888', marginTop: 4, marginBottom: 20 },
  carte: { backgroundColor: 'white', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E5E0' },
  carteEntete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reference: { fontSize: 15, fontWeight: '700' },
  badge: { backgroundColor: '#FAEEDA', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeTexte: { fontSize: 11, color: '#633806', fontWeight: '600' },
  date: { fontSize: 12, color: '#666' },
  gps: { fontSize: 11, color: '#999', marginTop: 4, fontFamily: 'monospace' },
  vide: { flex: 1, backgroundColor: '#F5F5F0', alignItems: 'center', justifyContent: 'center', padding: 24 },
  videIcone: { fontSize: 48, marginBottom: 16 },
  videTexte: { fontSize: 18, fontWeight: '600' },
  videSSTexte: { fontSize: 14, color: '#888', marginTop: 6, textAlign: 'center' },
  btnRetour: { marginTop: 24, padding: 12 },
  txtRetour: { color: '#185FA5', fontSize: 15 },
});