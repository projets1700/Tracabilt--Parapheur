import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import EcranConnexion from './src/screens/EcranConnexion';
import EcranAccueil from './src/screens/EcranAccueil';
import EcranScanner from './src/screens/EcranScanner';
import EcranScanReussi from './src/screens/EcranScanReussi';
import EcranSynchronisation from './src/screens/EcranSynchronisation';
import EcranHistorique from './src/screens/EcranHistorique';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Connexion"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Connexion"       component={EcranConnexion} />
        <Stack.Screen name="Accueil"         component={EcranAccueil} />
        <Stack.Screen name="Scanner"         component={EcranScanner} />
        <Stack.Screen name="ScanReussi"      component={EcranScanReussi} />
        <Stack.Screen name="Synchronisation" component={EcranSynchronisation} />
        <Stack.Screen name="Historique"      component={EcranHistorique} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
