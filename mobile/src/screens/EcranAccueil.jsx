import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { getScansEnAttente, supprimerSession } from '../services/stockage';

export default function EcranAccueil({ navigation, route }) {
  const { utilisateur } = route.params;
  const [nbEnAttente, setNbEnAttente] = useState(0);

  useEffect(() => {
    const chargerCompteur = async () => {
      const scans = await getScansEnAttente();
      setNbEnAttente(scans.length);
    };
    chargerCompteur();
    const unsub = navigation.addListener('focus', chargerCompteur);
    return unsub;
  }, [navigation]);

  async function handleDeconnexion() {
    await supprimerSession();
    navigation.replace('Connexion');
  }

  function confirmerDeconnexion() {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: handleDeconnexion },
    ]);
  }

  return (
    <View style={styles.conteneur}>
      <View style={styles.entete}>
        <View>
          <Text style={styles.bonjour}>Bonjour,</Text>
          <Text style={styles.nom}>{utilisateur.prenom} {utilisateur.nom}</Text>
        </View>
        <TouchableOpacity onPress={confirmerDeconnexion} style={styles.btnDeconnexion}>
          <Text style={styles.txtDeconnexion}>Quitter</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grille}>
        <TouchableOpacity style={[styles.carte, styles.cartePrimaire]} onPress={() => navigation.navigate('Scanner', { utilisateur })} activeOpacity={0.85}>
          <Text style={styles.carteIcone}>📷</Text>
          <Text style={styles.carteTitrePrimaire}>Scanner un QR Code</Text>
          <Text style={styles.carteSousTitrePrimaire}>Enregistrer un scan</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.carte} onPress={() => navigation.navigate('Synchronisation', { utilisateur })} activeOpacity={0.85}>
          <Text style={styles.carteIcone}>🔄</Text>
          <Text style={styles.carteTitre}>Synchroniser</Text>
          {nbEnAttente > 0
            ? <Text style={styles.badge}>{nbEnAttente} en attente</Text>
            : <Text style={styles.carteSousTitre}>Tout est à jour</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.carte} onPress={() => navigation.navigate('Historique')} activeOpacity={0.85}>
          <Text style={styles.carteIcone}>📋</Text>
          <Text style={styles.carteTitre}>Historique local</Text>
          <Text style={styles.carteSousTitre}>Scans enregistrés</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: '#F5F5F0' },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#185FA5', padding: 24, paddingTop: 60 },
  bonjour: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  nom: { color: 'white', fontSize: 20, fontWeight: '700' },
  btnDeconnexion: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  txtDeconnexion: { color: 'white', fontSize: 13 },
  grille: { padding: 20, gap: 14 },
  carte: { backgroundColor: 'white', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E5E5E0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cartePrimaire: { backgroundColor: '#185FA5', borderColor: '#185FA5' },
  carteIcone: { fontSize: 28, marginBottom: 10 },
  carteTitre: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  carteTitrePrimaire: { fontSize: 16, fontWeight: '600', color: 'white' },
  carteSousTitre: { fontSize: 13, color: '#888', marginTop: 4 },
  carteSousTitrePrimaire: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  badge: { fontSize: 12, color: '#BA7517', fontWeight: '600', marginTop: 4, backgroundColor: '#FAEEDA', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, alignSelf: 'flex-start' },
});