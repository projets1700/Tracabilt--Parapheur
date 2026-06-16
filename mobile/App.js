import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import EcranConnexion from './src/screens/EcranConnexion';
import EcranScanner from './src/screens/EcranScanner';
import EcranHistorique from './src/screens/EcranHistorique';
import EcranSynchronisation from './src/screens/EcranSynchronisation';
import { chargerSession, supprimerSession } from './src/services/stockage';

const Tab = createBottomTabNavigator();

function TabIcon({ emoji }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function App() {
  const [token, setToken] = useState(null);
  const [scanner, setScanner] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    chargerSession().then(({ token: t, scanner: s }) => {
      setToken(t);
      setScanner(s);
      setChargement(false);
    });
  }, []);

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e40af' }}>
        <ActivityIndicator size="large" color="white" />
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
          tabBarActiveTintColor: '#1e40af',
          tabBarInactiveTintColor: '#9ca3af',
          tabBarStyle: { paddingBottom: 4, paddingTop: 4 },
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