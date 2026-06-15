import { View, Text, StyleSheet } from 'react-native';
import BoutonPrincipal from '../components/BoutonPrincipal';

export default function EcranScanReussi({ navigation, route }) {
  const { reference, position, succes, utilisateur } = route.params;

  return (
    <View style={styles.conteneur}>
      <View style={styles.iconeConteneur}>
        <Text style={styles.icone}>{succes ? '✅' : '📥'}</Text>
      </View>

      <Text style={styles.titre}>{succes ? 'Scan enregistré !' : 'Scan sauvegardé'}</Text>
      <Text style={styles.sousTitre}>
        {succes
          ? 'Le scan a été envoyé au serveur avec succès.'
          : 'Pas de réseau — le scan sera synchronisé automatiquement.'}
      </Text>

      <View style={styles.details}>
        <View style={styles.ligne}>
          <Text style={styles.ligneLabel}>Référence</Text>
          <Text style={styles.ligneValeur}>{reference}</Text>
        </View>
        <View style={styles.separateur} />
        <View style={styles.ligne}>
          <Text style={styles.ligneLabel}>GPS</Text>
          <Text style={styles.ligneValeur}>
            {position
              ? `${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`
              : 'Non disponible'}
          </Text>
        </View>
        <View style={styles.separateur} />
        <View style={styles.ligne}>
          <Text style={styles.ligneLabel}>Heure</Text>
          <Text style={styles.ligneValeur}>
            {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>

      <View style={styles.boutons}>
        <BoutonPrincipal
          titre="Scanner à nouveau"
          onPress={() => navigation.replace('Scanner', { utilisateur })}
        />
        <BoutonPrincipal
          titre="Retour à l'accueil"
          variante="secondaire"
          onPress={() => navigation.navigate('Accueil', { utilisateur })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: '#F5F5F0', padding: 24, alignItems: 'center', justifyContent: 'center' },
  iconeConteneur: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  icone: { fontSize: 40 },
  titre: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  sousTitre: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  details: { backgroundColor: 'white', borderRadius: 16, padding: 20, width: '100%', marginBottom: 28, borderWidth: 1, borderColor: '#E5E5E0' },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  ligneLabel: { fontSize: 13, color: '#888' },
  ligneValeur: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  separateur: { height: 1, backgroundColor: '#F0F0EB' },
  boutons: { width: '100%', gap: 10 },
});