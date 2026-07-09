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
import { theme } from '../theme';

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
        <Text style={styles.sousTitre}>Connexion opérateur</Text>

        <View style={styles.groupe}>
          <Text style={styles.label}>Nom du scanner</Text>
          <TextInput
            style={styles.champ}
            placeholder="Votre identifiant"
            placeholderTextColor={theme.placeholder}
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
            placeholderTextColor={theme.placeholder}
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
            <ActivityIndicator color={theme.blanc} />
          ) : (
            <Text style={styles.boutonTexte}>Se connecter</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.fond },
  inner: { flex: 1, justifyContent: 'center', padding: 32, gap: 16 },
  sousTitre: {
    fontSize: 14,
    color: theme.texte,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  groupe: { gap: 6 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.bleu,
  },
  champ: {
    backgroundColor: theme.blanc,
    borderRadius: 10,
    padding: 16,
    color: theme.texteFonce,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.bordure,
  },
  bouton: {
    backgroundColor: theme.teal,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  boutonTexte: {
    color: theme.blanc,
    fontWeight: '700',
    fontSize: 16,
  },
});
