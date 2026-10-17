import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, FlatList, Alert, StyleSheet } from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { supabase, searchByPhoto, findByBarcode, findDeliveryByBarcode, learnScan } from '../lib/supabase';
import { ensureCameraPermission } from '../lib/camera';
import { useAuth } from '../lib/auth';
import { EXACT_MIN, EXACT_GAP, LEARN_MIN } from '../lib/config';
import { C, shadow } from '../lib/theme';
import { ProductRow } from '../lib/types';
import ProductCard from '../components/ProductCard';
import BarcodeScanner from '../components/BarcodeScanner';
import Screen from '../components/Screen';

export default function Scan() {
  const nav = useNavigation<any>();
  const focused = useIsFocused();
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'store'; // may add products
  const [mode, setMode] = useState<'photo' | 'barcode'>('photo');
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [results, setResults] = useState<ProductRow[] | null>(null);
  const [emb, setEmb] = useState<number[] | null>(null);
  const [handling, setHandling] = useState(false);

  // ---------- Photo search ----------
  async function snap() {
    if (!(await ensureCameraPermission())) return Alert.alert('Camera permission needed');
    const shot = await launchCamera({ mediaType: 'photo', includeBase64: true, quality: 0.4, maxWidth: 800, maxHeight: 800 });
    if (shot.didCancel) return;
    if (shot.errorCode) return Alert.alert('Camera error', shot.errorMessage || shot.errorCode);
    const a = shot.assets?.[0];
    if (!a?.base64) return;
    setPhoto(a.uri ?? null);
    setResults(null);
    setBusy(true);
    try {
      const { rows, embedding } = await searchByPhoto(a.base64);
      const ids = rows.map((r) => r.id);
      let extra: any[] = [];
      if (ids.length) {
        const res = await supabase.from('products')
          .select('id,category,low_stock_level,product_images(image_url)').in('id', ids);
        extra = res.data ?? [];
      }
      const map: Record<string, any> = Object.fromEntries(extra.map((e) => [e.id, e]));
      setEmb(embedding);
      setResults(rows.map((r) => ({
        ...r,
        category: map[r.id]?.category,
        low_stock_level: map[r.id]?.low_stock_level,
        thumb: map[r.id]?.product_images?.[0]?.image_url,
      })));
    } catch (e: any) {
      Alert.alert('Search failed', e.message);
    }
    setBusy(false);
  }

  const reset = () => { setPhoto(null); setResults(null); setEmb(null); };

  function open(item: ProductRow) {
    if (emb && (item.similarity ?? 0) >= LEARN_MIN) learnScan(item.id, emb); // teaches the app this look
    nav.navigate('Product', { id: item.id });
  }

  const top = results?.[0];
  const second = results?.[1];
  const exact = !!top && (top.similarity ?? 0) >= EXACT_MIN &&
    (!second || (top.similarity ?? 0) - (second.similarity ?? 0) >= EXACT_GAP);

  // ---------- Barcode ----------
  async function onCode(code: string) {
    setHandling(true);
    try {
      const p = await findByBarcode(code);
      if (p) { nav.navigate('Product', { id: p.id }); setHandling(false); return; }
      const dl = role === 'admin' || role === 'sales' ? await findDeliveryByBarcode(code) : null;
      if (dl) { nav.navigate('DeliveryDetail', { id: dl.id }); setHandling(false); return; }
      Alert.alert('Barcode not found', `No product has barcode ${code}.`, [
        { text: 'Scan again', onPress: () => setHandling(false) },
        ...(isAdmin ? [{ text: 'Add product', onPress: () => { setHandling(false); nav.navigate('Add', { barcode: code }); } }] : []),
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message, [{ text: 'OK', onPress: () => setHandling(false) }]);
    }
  }

  const photoHeader = (
    <View>
      {!photo ? (
        <View style={st.hero}>
          <TouchableOpacity activeOpacity={0.85} style={st.camBtn} onPress={snap}>
            <Text style={{ fontSize: 40 }}>📷</Text>
          </TouchableOpacity>
          <Text style={st.heroTitle}>Tap to scan</Text>
          <View style={st.tips}>
            <Text style={st.tip}>• Keep the light in the centre</Text>
            <Text style={st.tip}>• Use good lighting, avoid shadows</Text>
            <Text style={st.tip}>• One product per photo</Text>
          </View>
        </View>
      ) : (
        <View style={st.previewCard}>
          {photo ? <Image source={{ uri: photo }} style={st.preview} /> : null}
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={st.previewTitle}>{busy ? 'Searching…' : 'Your photo'}</Text>
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <TouchableOpacity style={st.retake} onPress={snap}><Text style={st.retakeText}>Retake</Text></TouchableOpacity>
              <TouchableOpacity style={st.clear} onPress={reset}><Text style={st.clearText}>Clear</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      {busy && <ActivityIndicator size="large" color={C.accent} style={{ marginVertical: 24 }} />}
      {results && !busy && results.length > 0 && (
        <View style={[st.banner, { backgroundColor: exact ? C.greenBg : C.amberBg }]}>
          <Text style={[st.bannerText, { color: exact ? C.green : C.amber }]}>
            {exact ? '✓ Exact match found' : 'Not sure. Please check the matches and pick the right one.'}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <Screen>
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={st.title}>Find Product</Text>
        <View style={st.seg}>
          {(['photo', 'barcode'] as const).map((m) => (
            <TouchableOpacity key={m} style={[st.segBtn, mode === m && st.segOn]} onPress={() => setMode(m)}>
              <Text style={[st.segText, mode === m && { color: '#fff' }]}>{m === 'photo' ? '📷 Photo' : '▮▯▮ Barcode'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {mode === 'photo' ? (
        <FlatList
          data={busy ? [] : results ?? []}
          keyExtractor={(i) => i.id}
          ListHeaderComponent={photoHeader}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          renderItem={({ item, index }) => (
            <ProductCard item={item} match={item.similarity} badge={index === 0 ? (exact ? 'exact' : 'best') : undefined}
              onPress={() => open(item)} />
          )}
          ListEmptyComponent={results && !busy ? (
            <View style={st.empty}>
              <Text style={{ fontSize: 40 }}>🔍</Text>
              <Text style={st.emptyTitle}>No product found</Text>
              <Text style={st.emptyText}>Try another angle, scan the barcode, or use the Search tab.</Text>
            </View>
          ) : null}
        />
      ) : (
        <View style={{ padding: 16 }}>
          <View style={st.camWrap}>
            <BarcodeScanner active={focused && !handling} onScanned={onCode} />
            {handling && <View style={st.busyOverlay}><ActivityIndicator color="#fff" size="large" /></View>}
          </View>
          <Text style={st.hint}>Point the camera at the barcode or QR sticker. Product details open automatically.</Text>
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: C.ink },
  seg: { flexDirection: 'row', backgroundColor: C.grayBg, borderRadius: 12, padding: 4, marginTop: 12 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segOn: { backgroundColor: C.ink },
  segText: { fontWeight: '800', color: C.ink },
  hero: { backgroundColor: C.card, borderRadius: 20, alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, ...shadow },
  camBtn: { width: 110, height: 110, borderRadius: 55, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 6, borderColor: C.accentSoft },
  heroTitle: { fontSize: 18, fontWeight: '700', color: C.ink, marginTop: 14 },
  tips: { marginTop: 14, alignSelf: 'stretch', backgroundColor: C.bg, borderRadius: 12, padding: 12 },
  tip: { fontSize: 13, color: C.sub, marginVertical: 2 },
  previewCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 16, padding: 12, ...shadow },
  preview: { width: 96, height: 96, borderRadius: 12 },
  previewTitle: { fontSize: 16, fontWeight: '700', color: C.ink },
  retake: { backgroundColor: C.ink, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, marginRight: 8 },
  retakeText: { color: '#fff', fontWeight: '700' },
  clear: { backgroundColor: C.grayBg, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  clearText: { color: C.ink, fontWeight: '700' },
  banner: { borderRadius: 12, padding: 12, marginTop: 16, marginBottom: 12 },
  bannerText: { fontWeight: '800', fontSize: 14 },
  camWrap: { height: 360, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' },
  busyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  hint: { color: C.sub, textAlign: 'center', marginTop: 14, fontSize: 13 },
  empty: { alignItems: 'center', padding: 30 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.ink, marginTop: 8 },
  emptyText: { color: C.sub, marginTop: 4, textAlign: 'center' },
});
