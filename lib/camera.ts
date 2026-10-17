import { PermissionsAndroid, Platform } from 'react-native';

// Needed before launchCamera() because AndroidManifest now declares CAMERA (for the barcode scanner).
export async function ensureCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}
