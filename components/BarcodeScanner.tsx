import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { C } from '../lib/theme';

const CODE_TYPES = ['qr', 'ean-13', 'ean-8', 'upc-a', 'upc-e', 'code-128', 'code-39'] as const;

type Props = { active: boolean; onScanned: (code: string) => void };

export default function BarcodeScanner({ active, onScanned }: Props) {
  const device = useCameraDevice('back');
  const [granted, setGranted] = useState<boolean | null>(null);
  const lock = useRef(false);
  const cb = useRef(onScanned);
  cb.current = onScanned;

  useEffect(() => {
    Camera.requestCameraPermission().then((r) => setGranted(r === 'granted'));
  }, []);
  useEffect(() => { if (active) lock.current = false; }, [active]);

  const codeScanner = useCodeScanner({
    codeTypes: [...CODE_TYPES],
    onCodeScanned: (codes) => {
      const v = codes[0]?.value;
      if (!v || lock.current) return;
      lock.current = true;          // one scan at a time
      cb.current(v);
    },
  });

  if (granted === false) {
    return (
      <View style={st.center}>
        <Text style={st.msg}>Camera permission is needed to scan barcodes.</Text>
        <TouchableOpacity style={st.btn} onPress={() => Linking.openSettings()}>
          <Text style={st.btnText}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!device || granted === null) {
    return <View style={st.center}><Text style={st.msg}>Starting camera…</Text></View>;
  }
  return (
    <View style={StyleSheet.absoluteFill}>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive={active} codeScanner={codeScanner} />
      <View style={st.frameWrap} pointerEvents="none"><View style={st.frame} /></View>
    </View>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#000' },
  msg: { color: '#fff', textAlign: 'center', fontSize: 15 },
  btn: { backgroundColor: C.accent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, marginTop: 14 },
  btnText: { fontWeight: '800', color: C.ink },
  frameWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '72%', height: 150, borderWidth: 3, borderColor: C.accent, borderRadius: 16 },
});
