import * as Location from 'expo-location';

export async function demanderPermissions() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function obtenirPosition() {
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    precision_gps: Math.round(location.coords.accuracy ?? 0),
  };
}