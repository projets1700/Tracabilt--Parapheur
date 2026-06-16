import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { api } from '../services/api';
import { sauvegarderSession } from '../services/stockage';

export default function EcranConnexion({ onConnexion }) {
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);

  async function handleConnexion() {
    if (!identifiant.trim() || !motDePasse.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    setChargement(true);
    try {
      const data = await api.connexionScanner(identifiant.trim(), motDePasse.trim());
      await sauvegarderSession(data.token, data.scanner);
      onConnexion(data.token, data.scanner);
    } catch (err) {
      Alert.alert('Connexion échouée', err.message || 'Identifiant ou mot de passe incorrect.');
    } finally {
      setChargement(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.titre}>TraçaParapheur</Text>
        <Text style={styles.sousTitre}>Connexion opérateur</Text>

        <TextInput
          style={styles.champ}
          placeholder="Identifiant (ex: j.martin)"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={identifiant}
          onChangeText={setIdentifiant}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.champ}
          placeholder="Mot de passe"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={motDePasse}
          onChangeText={setMotDePasse}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.bouton, chargement && { opacity: 0.6 }]}
          onPress={handleConnexion}
          disabled={chargement}
        >
          {chargement
            ? <ActivityIndicator color="#1e40af" />
            : <Text style={styles.boutonTexte}>Se connecter</Text>
          }
        </TouchableOpacity>

        <Text style={styles.aide}>Démo : j.martin / scanner123</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e40af' },
  inner: { flex: 1, justifyContent: 'center', padding: 32, gap: 14 },
  titre: { fontSize: 28, fontWeight: '700', color: 'white', textAlign: 'center' },
  sousTitre: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 12 },
  champ: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 16,
    color: 'white',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  bouton: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  boutonTexte: { color: '#1e40af', fontWeight: '700', fontSize: 16 },
  aide: { textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 8 },
});