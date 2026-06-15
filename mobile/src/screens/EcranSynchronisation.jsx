import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getScansEnAttente, viderScansEnAttente } from '../services/stockage';
import { synchroniserScans } from '../services/api';
import BoutonPrincipal from '../components/BoutonPrincipal';

export default function EcranSynchronisation({ navigation, route }) {
  const { utilisateur } = route.params;
  const [scans, setScans] = useState([]);
  const [etat, setEtat] = useState('attente'); // attente | sync | succes | erreur
  const [resultat, setResultat] = useState(null);

  useEffect(() => {
    getScansEnAttente().then(setScans);
  }, []);

  async function handleSync() {
    if (scans.length === 0) return;
    setEtat('sync');
    try {
      const data = await synchroniserScans(scans);
      await viderScansEnAttente();
      setResultat(data);
      setEtat('succes');
      setScans([]);
    } catch {
      setEtat('erreur');
    }
  }

  return (
    <View style={styles.conteneur}>
      <Text style={styles.titre}>Synchronisation</Text>

      {etat === 'attente' && (
        <>
          {scans.length === 0 ? (
            <View style={styles.vide}>
              <Text style={styles.videIcone}>✅</Text>
              <Text style={styles.videTexte}>Tout est synchronisé</Text>
              <Text style={styles.videSSTexte}>Aucun scan en attente</Text>
            </View>
          ) : (
            <>
              <View style={styles.compteur}>
                <Text style={styles.compteurNb}>{scans.length}</Text>
                <Text style={styles.compteurLabel}>scan{scans.length > 1 ? 's' : ''} en attente</Text>
              </View>
              <View style={styles.listePrevisuBordure}>
                {scans.slice(0, 5).map((s, i) => (
                  <View key={s.id_local} style={[styles.itemScan, i > 0 && styles.separateur]}>
                    <Text style={styles.itemRef}>{s.parapheur_reference}</Text>
                    <Text style={styles.itemDate}>{new Date(s.date_scan).toLocaleString('fr-FR')}</Text>
                  </View>
                ))}
                {scans.length > 5 && (
                  <Text style={styles.plusItems}>+ {scans.length - 5} autres…</Text>
                )}
              </View>
              <BoutonPrincipal titre="Synchroniser maintenant" onPress={handleSync} />
            </>
          )}
        </>
      )}

      {etat === 'sync' && (
        <BoutonPrincipal titre="Synchronisation en cours…" chargement onPress={() => {}} />
      )}

      {etat === 'succes' && (
        <View style={styles.resultat}>
          <Text style={styles.resultatIcone}>✅</Text>
          <Text style={styles.resultatTitre}>{resultat.synchronises} / {resultat.total} synchronisés</Text>
          <BoutonPrincipal titre="Retour à l'accueil" variante="secondaire" onPress={() => navigation.navigate('Accueil', { utilisateur })} />
        </View>
      )}

      {etat === 'erreur' && (
        <View style={styles.resultat}>
          <Text style={styles.resultatIcone}>❌</Text>
          <Text style={styles.resultatTitre}>Erreur réseau</Text>
          <Text style={styles.resultatSousTitre}>Vérifiez votre connexion et réessayez.</Text>
          <BoutonPrincipal titre="Réessayer" onPress={() => setEtat('attente')} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: '#F5F5F0', padding: 24 },
  titre: { fontSize: 22, fontWeight: '700', marginBottom: 24, marginTop: 20 },
  vide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  videIcone: { fontSize: 48, marginBottom: 16 },
  videTexte: { fontSize: 18, fontWeight: '600', color: '#1a1a1a' },
  videSSTexte: { fontSize: 14, color: '#888', marginTop: 6 },
  compteur: { backgroundColor: '#185FA5', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 16 },
  compteurNb: { fontSize: 48, fontWeight: '700', color: 'white' },
  compteurLabel: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  listePrevisuBordure: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E5E5E0' },
  itemScan: { paddingVertical: 10 },
  separateur: { borderTopWidth: 1, borderTopColor: '#F0F0EB' },
  itemRef: { fontSize: 13, fontWeight: '600' },
  itemDate: { fontSize: 12, color: '#888', marginTop: 2 },
  plusItems: { fontSize: 12, color: '#888', marginTop: 8, textAlign: 'center' },
  resultat: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  resultatIcone: { fontSize: 48, marginBottom: 8 },
  resultatTitre: { fontSize: 18, fontWeight: '600' },
  resultatSousTitre: { fontSize: 14, color: '#666', textAlign: 'center' },
});