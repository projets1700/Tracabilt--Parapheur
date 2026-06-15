import * as Location from 'expo-location';

export async function demanderPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getPosition() {
  const autorise = await demanderPermission();
  if (!autorise) return null;

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      precision_gps: position.coords.accuracy,
    };
  } catch {
    return null;
  }
}