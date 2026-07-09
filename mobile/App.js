import NetInfo from '@react-native-community/netinfo';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, ToastAndroid, Platform, View } from 'react-native';

import EcranConnexion from './src/screens/EcranConnexion';
import EcranScanner from './src/screens/EcranScanner';
import EcranHistorique from './src/screens/EcranHistorique';
import EcranSynchronisation from './src/screens/EcranSynchronisation';
import { chargerSession, supprimerSession } from './src/services/stockage';
import { chargerScansEnAttente, marquerToutSynchronise } from './src/services/stockage';
import { api } from './src/services/api';
import { theme } from './src/theme';

const Tab = createBottomTabNavigator();

function TabIcon({ emoji }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

function afficherNotif(message) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}

export default function App() {
  const [token, setToken] = useState(null);
  const [scanner, setScanner] = useState(null);
  const [chargement, setChargement] = useState(true);
  const etaitConnecte = useRef(false);

  useEffect(() => {
    chargerSession().then(({ token: t, scanner: s }) => {
      setToken(t);
      setScanner(s);
      setChargement(false);
    });
  }, []);

  const syncAuto = useCallback(async () => {
    if (!token) return;
    const pending = await chargerScansEnAttente();
    if (pending.length === 0) return;
    try {
      await api.synchroniserScans(pending);
      await marquerToutSynchronise();
      afficherNotif(`✓ ${pending.length} scan(s) synchronisé(s)`);
    } catch {
      // Silencieux — réessayera à la prochaine reconnexion
    }
  }, [token]);

  // Écoute le retour du réseau et synchronise automatiquement
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connecte = state.isConnected && state.isInternetReachable !== false;
      if (connecte && !etaitConnecte.current) {
        syncAuto();
      }
      etaitConnecte.current = connecte;
    });
    return () => unsubscribe();
  }, [syncAuto]);

  function handleConnexion(t, s) {
    setToken(t);
    setScanner(s);
  }

  async function handleDeconnexion() {
    await supprimerSession();
    setToken(null);
    setScanner(null);
  }

  if (chargement) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.fond }}>
        <ActivityIndicator size="large" color={theme.teal} />
      </View>
    );
  }

  if (!token) {
    return <EcranConnexion onConnexion={handleConnexion} />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.teal,
          tabBarInactiveTintColor: theme.texte,
          tabBarStyle: {
            paddingBottom: 4,
            paddingTop: 4,
            backgroundColor: theme.blanc,
            borderTopColor: theme.bordure,
            borderTopWidth: 1,
            elevation: 8,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
          },
        }}
      >
        <Tab.Screen
          name="Scanner"
          options={{ tabBarIcon: () => <TabIcon emoji="📷" /> }}
        >
          {() => <EcranScanner scanner={scanner} onDeconnexion={handleDeconnexion} />}
        </Tab.Screen>
        <Tab.Screen
          name="Historique"
          component={EcranHistorique}
          options={{ tabBarIcon: () => <TabIcon emoji="📋" /> }}
        />
        <Tab.Screen
          name="Sync"
          component={EcranSynchronisation}
          options={{ tabBarIcon: () => <TabIcon emoji="🔄" /> }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}