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

export async function obtenirLieu(latitude, longitude) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=fr`;
    const res = await fetch(url, { headers: { 'User-Agent': 'TracaParapheur/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};
    const nom_lieu =
      data.name ||
      addr.suburb ||
      addr.neighbourhood ||
      addr.quarter ||
      addr.village ||
      addr.town ||
      addr.city ||
      null;
    if (!nom_lieu) return null;
    return {
      nom_lieu,
      adresse: [addr.house_number, addr.road].filter(Boolean).join(' ') || null,
      ville: addr.city || addr.town || addr.village || null,
      code_postal: addr.postcode || null,
      pays: addr.country || null,
    };
  } catch {
    return null;
  }
}