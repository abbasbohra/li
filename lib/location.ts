import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';

export type Coords = { lat: number; lng: number };
export const DELIVERY_RADIUS_M = 200; // delivery person must be this close to mark as delivered (server allows 300 m for GPS error)

export async function getCurrentCoords(): Promise<Coords> {
  if (Platform.OS === 'android') {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    if (r !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Location permission was denied. Allow it in phone settings.');
  }
  return new Promise((resolve, reject) =>
    Geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.message || 'Could not get your location. Turn on GPS and try again.')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
    ));
}

export function distanceM(a: Coords, b: Coords) {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}
export const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

// Reads "26.9124,75.7873" or a Google Maps link that contains the pin
const N = '(-?\\d{1,3}(?:\\.\\d+)?)';
const PATTERNS = [
  new RegExp(`@${N},${N}`),
  new RegExp(`[?&](?:q|ll|query|destination|center)=${N}(?:,|%2C)${N}`),
  new RegExp(`!3d${N}!4d${N}`),
  new RegExp(`^\\s*${N}\\s*,\\s*${N}\\s*$`),
];
export function parseLocation(text: string): Coords | null {
  for (const re of PATTERNS) {
    const m = text.match(re);
    if (m) {
      const lat = +m[1], lng = +m[2];
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}
// short links (maps.app.goo.gl) are opened once to find the real address behind them
export async function resolveLocation(text: string): Promise<Coords | null> {
  const t = text.trim();
  const direct = parseLocation(t);
  if (direct || !/^https?:\/\//i.test(t)) return direct;
  try { const res = await fetch(t); return parseLocation(decodeURIComponent(res.url)); } catch { return null; }
}

export const mapsUrl = (c: Coords) => `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
export const directionsUrl = (c: Coords | null, address: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${c ? `${c.lat},${c.lng}` : encodeURIComponent(address)}`;
