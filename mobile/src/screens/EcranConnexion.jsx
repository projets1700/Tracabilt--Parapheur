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
      const data = await api.connexionScanner(
        identifiant.trim(),
        motDePasse.trim()
      );

      await sauvegarderSession(data.token, data.utilisateur);
      onConnexion(data.token, data.utilisateur);
    } catch (err) {
      Alert.alert(
        'Connexion échouée',
        err.message || 'Identifiant ou mot de passe incorrect.'
      );
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

        <View style={styles.groupe}>
          <Text style={styles.label}>Nom du scanner</Text>
          <TextInput
            style={styles.champ}
            placeholder="Ex : j.martin"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={identifiant}
            onChangeText={setIdentifiant}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.groupe}>
          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            style={styles.champ}
            placeholder="••••••••"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={motDePasse}
            onChangeText={setMotDePasse}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={[styles.bouton, chargement && { opacity: 0.6 }]}
          onPress={handleConnexion}
          disabled={chargement}
        >
          {chargement ? (
            <ActivityIndicator color="#1e40af" />
          ) : (
            <Text style={styles.boutonTexte}>Se connecter</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e40af' },
  inner: { flex: 1, justifyContent: 'center', padding: 32, gap: 16 },
  titre: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
  },
  sousTitre: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 8,
  },
  groupe: { gap: 6 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
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
    marginTop: 4,
  },
  boutonTexte: {
    color: '#1e40af',
    fontWeight: '700',
    fontSize: 16,
  },
});