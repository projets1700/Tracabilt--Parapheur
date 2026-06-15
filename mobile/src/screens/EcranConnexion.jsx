import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { connexionScanner } from '../services/api';
import { sauvegarderSession } from '../services/stockage';
import BoutonPrincipal from '../components/BoutonPrincipal';

export default function EcranConnexion({ navigation }) {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);

  async function handleConnexion() {
    if (!email.trim() || !motDePasse) {
      Alert.alert('Champs manquants', 'Veuillez renseigner votre email et mot de passe.');
      return;
    }
    setChargement(true);
    try {
      const data = await connexionScanner(email.trim(), motDePasse);
      await sauvegarderSession(data.token, data.utilisateur);
      navigation.replace('Accueil', { utilisateur: data.utilisateur });
    } catch (err) {
      Alert.alert('Erreur de connexion', err.response?.data?.message || 'Identifiants incorrects.');
    } finally {
      setChargement(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.conteneur} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.entete}>
        <Text style={styles.icone}>📋</Text>
        <Text style={styles.titre}>TraçaParapheur</Text>
        <Text style={styles.sousTitre}>Application scanner</Text>
      </View>

      <View style={styles.formulaire}>
        <View style={styles.champ}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="prenom.nom@organisation.fr"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={styles.champ}>
          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            value={motDePasse}
            onChangeText={setMotDePasse}
            secureTextEntry
          />
        </View>
        <BoutonPrincipal titre="Se connecter" onPress={handleConnexion} chargement={chargement} />
      </View>

      <View style={styles.demo}>
        <Text style={styles.demoTitre}>COMPTE DE DÉMO</Text>
        <Text style={styles.demoTexte}>j.martin@organisation.fr / operateur123</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: '#F5F5F0', padding: 24, justifyContent: 'center' },
  entete: { alignItems: 'center', marginBottom: 40 },
  icone: { fontSize: 48, marginBottom: 12 },
  titre: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
  sousTitre: { fontSize: 14, color: '#666', marginTop: 4 },
  formulaire: { backgroundColor: 'white', borderRadius: 16, padding: 20, gap: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  champ: { gap: 6 },
  label: { fontSize: 12, color: '#666', fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#E5E5E0', borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: '#FAFAFA' },
  demo: { backgroundColor: 'white', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5E5E0' },
  demoTitre: { fontSize: 10, color: '#999', fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 },
  demoTexte: { fontSize: 12, color: '#666' },
});