import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, FlatList, Alert } from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { searchByPhoto } from '../lib/supabase';
import { s } from '../styles';

export default function Scan({ onOpen }) {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);

  async function snap() {
    const shot = await launchCamera({ mediaType: 'photo', includeBase64: true, quality: 0.4, maxWidth: 800, maxHeight: 800 });
    if (shot.didCancel) return;
    if (shot.errorCode) return Alert.alert('Camera error', shot.errorMessage || shot.errorCode);
    setBusy(true);
    try { setResults(await searchByPhoto(shot.assets[0].base64)); }
    catch (e) { Alert.alert('Search failed', e.message); }
    setBusy(false);
  }

  return (
    <View style={s.screen}>
      <TouchableOpacity style={s.bigBtn} onPress={snap}>
        <Text style={s.bigBtnText}>📷  Click Product Photo</Text>
      </TouchableOpacity>
      {busy && <ActivityIndicator size="large" style={{ marginTop: 20 }} />}
      {results && !busy && (
        <>
          <Text style={s.h2}>Top matches — tap the right one</Text>
          <FlatList data={results} keyExtractor={(i) => i.id} renderItem={({ item }) => (
            <TouchableOpacity style={s.card} onPress={() => onOpen(item.id)}>
              <Text style={s.title}>{item.name}</Text>
              <Text>SKU: {item.sku}  •  ₹{item.price}  •  Stock: {item.stock}</Text>
              <Text style={s.muted}>Match: {Math.round(item.similarity * 100)}%</Text>
            </TouchableOpacity>
          )} ListEmptyComponent={<Text style={s.muted}>No products found. Add product photos first.</Text>} />
        </>
      )}
    </View>
  );
}
