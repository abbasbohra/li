import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Linking, ActivityIndicator } from 'react-native';
import { Coords, getCurrentCoords, mapsUrl, resolveLocation } from '../lib/location';
import { C } from '../lib/theme';
import { ui } from '../lib/ui';

type Props = { value: Coords | null; onChange: (c: Coords | null) => void };

// Delivery location: paste a Google Maps link / "lat,lng", or use this phone's GPS
export default function LocationPicker({ value, onChange }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function useLink() {
    setBusy(true);
    const c = await resolveLocation(text);
    setBusy(false);
    if (!c) return Alert.alert("Couldn't read the location", 'Paste a Google Maps link that shows the pin, or type latitude,longitude (for example 26.9124,75.7873).');
    onChange(c); setText('');
  }
  async function useGps() {
    setBusy(true);
    try { onChange(await getCurrentCoords()); } catch (e: any) { Alert.alert('Location', e.message); }
    setBusy(false);
  }

  if (value) {
    return (
      <View>
        <Text style={{ color: C.green, fontWeight: '800' }}>📍 Location saved</Text>
        <Text style={ui.muted}>{value.lat.toFixed(5)}, {value.lng.toFixed(5)}</Text>
        <View style={[ui.row, { marginTop: 10 }]}>
          <TouchableOpacity onPress={() => Linking.openURL(mapsUrl(value))}><Text style={{ color: '#1D4ED8', fontWeight: '800' }}>Open in Maps</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => onChange(null)} style={{ marginLeft: 18 }}><Text style={{ color: C.red, fontWeight: '800' }}>Remove</Text></TouchableOpacity>
        </View>
      </View>
    );
  }
  return (
    <View>
      <Text style={ui.label}>Paste Google Maps link or latitude,longitude</Text>
      <TextInput style={ui.input} value={text} onChangeText={setText} autoCapitalize="none" autoCorrect={false}
        placeholder="https://maps.app.goo.gl/…  or  26.9124,75.7873" placeholderTextColor={C.sub} />
      <View style={ui.row}>
        <TouchableOpacity style={[ui.btn, { flex: 1, marginTop: 0, marginRight: 8 }, (!text.trim() || busy) && { opacity: 0.5 }]}
          onPress={useLink} disabled={!text.trim() || busy}>
          <Text style={ui.btnText}>Use link</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[ui.btn, { flex: 1, marginTop: 0, backgroundColor: C.accent }, busy && { opacity: 0.5 }]} onPress={useGps} disabled={busy}>
          {busy ? <ActivityIndicator /> : <Text style={[ui.btnText, { color: C.ink }]}>📍 I am here now</Text>}
        </TouchableOpacity>
      </View>
      <Text style={[ui.muted, { marginTop: 8 }]}>"I am here now" uses this phone's GPS, so use it when you are at the customer's place.</Text>
    </View>
  );
}
