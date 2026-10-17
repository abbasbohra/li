import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator, Modal, Switch, StyleSheet } from 'react-native';
import { launchCamera, launchImageLibrary, ImagePickerResponse, Asset } from 'react-native-image-picker';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { decode } from 'base64-arraybuffer';
import { supabase, embedImage, findByBarcode } from '../lib/supabase';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ensureCameraPermission } from '../lib/camera';
import { C, shadow } from '../lib/theme';
import { TabParamList } from '../lib/types';
import BarcodeScanner from '../components/BarcodeScanner';
import Screen from '../components/Screen';

const CATEGORIES = ['Chandelier', 'Pendant', 'Wall Light', 'Table Lamp', 'Floor Lamp', 'Night Lamp', 'String Light', 'Other'];
const OPTS = { mediaType: 'photo' as const, includeBase64: true, quality: 0.4 as const, maxWidth: 800, maxHeight: 800 };
const MAX_PHOTOS = 8;

type FieldProps = {
  label: string; value?: string; onChange: (v: string) => void;
  keyboardType?: 'default' | 'numeric'; placeholder?: string; multiline?: boolean;
  autoCapitalize?: 'none' | 'characters'; onBlur?: () => void;
};

function Field({ label, value, onChange, multiline, ...rest }: FieldProps) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={st.label}>{label}</Text>
      <TextInput
        style={[st.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value ?? ''} onChangeText={onChange} multiline={multiline}
        placeholderTextColor={C.sub} {...rest}
      />
    </View>
  );
}

export default function AddProduct() {
  const route = useRoute<RouteProp<TabParamList, 'Add'>>();
  const nav = useNavigation<any>();
  const { isAdmin } = useAuth();
  const [f, setF] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Asset[]>([]);
  const [existing, setExisting] = useState<{ id: string; name: string; barcode: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [autoCode, setAutoCode] = useState(true);
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  // barcode passed from the Scan screen ("Barcode not found -> Add product")
  useEffect(() => {
    const b = route.params?.barcode;
    if (b) setF((p) => ({ ...p, barcode: b }));
  }, [route.params?.barcode]);

  // "Add another variant" / "Add product here" pre-fills the category and model
  useEffect(() => {
    const { category, model } = route.params ?? {};
    if (category || model) setF((p) => ({ ...p, ...(category ? { category } : {}), ...(model ? { model } : {}) }));
  }, [route.params?.category, route.params?.model]);

  // models that already exist in the chosen category
  const [models, setModels] = useState<string[]>([]);
  useEffect(() => {
    const cat = (f.category ?? '').trim();
    if (!cat) { setModels([]); return; }
    supabase.from('products').select('model').eq('category', cat).not('model', 'is', null).limit(1000)
      .then(({ data }) => setModels(Array.from(new Set((data ?? []).map((r: any) => r.model as string).filter(Boolean))).sort()));
  }, [f.category]);

  async function checkSku() {
    const sku = (f.sku ?? '').trim();
    if (!sku) return setExisting(null);
    const { data } = await supabase.from('products').select('id,name,barcode').eq('sku', sku).maybeSingle();
    setExisting(data ?? null);
  }

  function addAssets(r: ImagePickerResponse) {
    if (r.didCancel) return;
    if (r.errorCode) return Alert.alert('Photo error', r.errorMessage || r.errorCode);
    setPhotos((p) => [...p, ...(r.assets ?? []).filter((a) => a.base64)].slice(0, MAX_PHOTOS));
  }
  const takePhoto = async () => {
    if (!(await ensureCameraPermission())) return Alert.alert('Camera permission needed');
    addAssets(await launchCamera(OPTS));
  };
  const pickPhotos = async () => addAssets(await launchImageLibrary({ ...OPTS, selectionLimit: MAX_PHOTOS - photos.length }));
  const removePhoto = (i: number) => setPhotos((p) => p.filter((_, k) => k !== i));
  const reset = () => { setF({}); setPhotos([]); setExisting(null); setProgress(''); };

  async function save() {
    const sku = (f.sku ?? '').trim();
    const barcode = (f.barcode ?? '').trim();
    if (!sku) return Alert.alert('SKU is required');
    if (photos.length === 0) return Alert.alert('Add at least 1 photo', '3-5 photos from different angles give the best search results.');
    if (!existing && (!(f.name || f.model) || !f.price)) return Alert.alert('Enter a name or a model, and the price');
    if (!existing && !(f.category ?? '').trim()) return Alert.alert('Choose a category', 'Pick one, or type a new category.');

    setBusy(true);
    try {
      if (barcode) {
        const owner = await findByBarcode(barcode);
        if (owner && owner.id !== existing?.id) throw new Error(`Barcode ${barcode} is already used by "${owner.name}".`);
      }
      const variant = [f.color, f.size, f.wattage].map((x) => (x ?? '').trim()).filter(Boolean).join(' · ');
      const modelName = (f.model ?? '').trim();
      let finalName = (f.name ?? '').trim() || modelName;
      if (modelName && finalName === modelName && variant) finalName = `${modelName} – ${variant}`;
      let pid = existing?.id;
      if (!existing) {
        setProgress('Saving product details…');
        const { data: p, error } = await supabase.from('products').insert({
          sku, name: finalName, model: modelName || null, category: (f.category ?? '').trim(), price: +f.price || 0, stock: +f.stock || 0,
          barcode: barcode || null, wattage: f.wattage, size: f.size, color: f.color,
          location: f.location, description: f.description,
        }).select().single();
        if (error) throw error;
        pid = p.id;
        if (f.cost_price) await supabase.from('product_costs').insert({ product_id: pid, cost_price: +f.cost_price });
      } else if (barcode && !existing.barcode) {
        const { error } = await supabase.from('products').update({ barcode }).eq('id', existing.id);
        if (error) throw error;
      }

      for (let i = 0; i < photos.length; i++) {
        setProgress(`Processing photo ${i + 1} of ${photos.length}…`);
        const b64 = photos[i].base64 as string;
        const path = `${pid}/${Date.now()}-${i}.jpg`;
        const up = await supabase.storage.from('product-images').upload(path, decode(b64), { contentType: 'image/jpeg' });
        if (up.error) throw up.error;
        const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
        const embedding = await embedImage(b64);
        const ins = await supabase.from('product_images').insert({ product_id: pid, image_url: url, embedding });
        if (ins.error) throw ins.error;
      }
      let code = barcode || existing?.barcode || '';
      if (!code && autoCode) {
        try { code = await api.generateBarcode(pid as string); } catch (_) {}
      }
      const savedId = pid as string;
      reset();
      Alert.alert('Saved ✅', code ? `Barcode: ${code}` : 'Product can now be found by photo.', [
        { text: 'Add another', style: 'cancel' },
        { text: 'View label', onPress: () => nav.navigate('Product', { id: savedId }) },
      ]);
    } catch (e: any) {
      Alert.alert('Could not finish', `${e.message}\n\nIf the product was already created, enter the same SKU again and add the photos.`);
    }
    setBusy(false);
  }

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={st.title}>Add Product</Text>
        <Text style={st.sub}>Take photos, add the barcode and details. Sales boys can then find it by photo or barcode.</Text>

        <View style={st.card}>
          <Text style={st.section}>1. Product photos</Text>
          <View style={st.grid}>
            {photos.map((p, i) => (
              <View key={i} style={st.thumbWrap}>
                <Image source={{ uri: p.uri }} style={st.thumb} />
                <TouchableOpacity style={st.remove} onPress={() => removePhoto(i)}><Text style={st.removeText}>✕</Text></TouchableOpacity>
              </View>
            ))}
          </View>
          {photos.length < MAX_PHOTOS && (
            <View style={{ flexDirection: 'row', marginTop: 4 }}>
              <TouchableOpacity style={st.camBtn} onPress={takePhoto}><Text style={st.camText}>📷  Camera</Text></TouchableOpacity>
              <TouchableOpacity style={st.galBtn} onPress={pickPhotos}><Text style={st.galText}>🖼  Gallery</Text></TouchableOpacity>
            </View>
          )}
          <Text style={[st.hint, photos.length >= 3 && { color: C.green }]}>
            {photos.length} photo{photos.length === 1 ? '' : 's'} added · 3-5 from different angles is best
          </Text>
        </View>

        <View style={st.card}>
          <Text style={st.section}>2. Product details</Text>
          <Field label="SKU / Model number *" value={f.sku} onChange={set('sku')} onBlur={checkSku}
            autoCapitalize="characters" placeholder="e.g. NL-013" />

          <Text style={st.label}>Barcode</Text>
          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
            <TextInput style={[st.input, { flex: 1 }]} value={f.barcode ?? ''} onChangeText={set('barcode')}
              placeholder="Type or scan" placeholderTextColor={C.sub} autoCapitalize="none" />
            <TouchableOpacity style={st.scanBtn} onPress={() => setScanOpen(true)}>
              <Text style={st.scanText}>Scan</Text>
            </TouchableOpacity>
          </View>
          {!f.barcode && !existing?.barcode && (
            <View style={[st.two, { alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }]}>
              <Text style={{ color: C.ink, fontWeight: '600', flex: 1, marginRight: 10 }}>
                Generate a barcode automatically after saving
              </Text>
              <Switch value={autoCode} onValueChange={setAutoCode} />
            </View>
          )}

          {existing ? (
            <View style={st.notice}>
              <Text style={st.noticeText}>
                SKU already exists ({existing.name}). Photos will be added to that product
                {existing.barcode ? '.' : ', and the barcode will be saved because it has none yet.'}
              </Text>
            </View>
          ) : (
            <>
              <Field label="Product name (empty = model + variant)" value={f.name} onChange={set('name')} placeholder="e.g. Moon Night Lamp" />
              <Text style={st.label}>Category *</Text>
              <View style={st.chips}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity key={c} style={[st.chip, f.category === c && st.chipOn]} onPress={() => set('category')(c)}>
                    <Text style={[st.chipText, f.category === c && { color: '#fff' }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={[st.input, { marginBottom: 12 }]}
                value={CATEGORIES.includes(f.category ?? '') ? '' : f.category ?? ''}
                onChangeText={set('category')} placeholder="Or type a new category" placeholderTextColor={C.sub} />
              <Text style={st.label}>Model (one lamp design that comes in different colours / sizes / wattages)</Text>
              {models.length > 0 && (
                <View style={st.chips}>
                  {models.map((m) => (
                    <TouchableOpacity key={m} style={[st.chip, f.model === m && st.chipOn]} onPress={() => set('model')(m)}>
                      <Text style={[st.chipText, f.model === m && { color: '#fff' }]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TextInput style={[st.input, { marginBottom: 12 }]}
                value={models.includes(f.model ?? '') ? '' : f.model ?? ''}
                onChangeText={set('model')} placeholder="Or type a new model name" placeholderTextColor={C.sub} />
              <View style={st.two}>
                <View style={{ flex: 1, marginRight: 8 }}><Field label="Selling price ₹ *" value={f.price} onChange={set('price')} keyboardType="numeric" /></View>
                {isAdmin && <View style={{ flex: 1 }}><Field label="Cost price ₹" value={f.cost_price} onChange={set('cost_price')} keyboardType="numeric" /></View>}
              </View>
              <View style={st.two}>
                <View style={{ flex: 1, marginRight: 8 }}><Field label="Stock qty" value={f.stock} onChange={set('stock')} keyboardType="numeric" /></View>
                <View style={{ flex: 1 }}><Field label="Shelf location" value={f.location} onChange={set('location')} placeholder="Rack A1" /></View>
              </View>
            </>
          )}
        </View>

        {!existing && (
          <View style={st.card}>
            <Text style={st.section}>3. Variant details (colour, size, wattage)</Text>
            <View style={st.two}>
              <View style={{ flex: 1, marginRight: 8 }}><Field label="Wattage" value={f.wattage} onChange={set('wattage')} placeholder="9W" /></View>
              <View style={{ flex: 1 }}><Field label="Size" value={f.size} onChange={set('size')} placeholder="12 inch" /></View>
            </View>
            <Field label="Colour" value={f.color} onChange={set('color')} placeholder="Warm white" />
            <Field label="Description" value={f.description} onChange={set('description')} multiline />
          </View>
        )}

        <TouchableOpacity style={[st.save, busy && { opacity: 0.7 }]} onPress={save} disabled={busy} activeOpacity={0.85}>
          {busy ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color="#fff" />
              <Text style={[st.saveText, { marginLeft: 10 }]}>{progress}</Text>
            </View>
          ) : (
            <Text style={st.saveText}>{existing ? 'Add Photos to Product' : 'Save Product'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={scanOpen} animationType="slide" onRequestClose={() => setScanOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <BarcodeScanner active={scanOpen} onScanned={(code) => { set('barcode')(code); setScanOpen(false); }} />
          <TouchableOpacity style={st.closeScan} onPress={() => setScanOpen(false)}>
            <Text style={st.saveText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </Screen>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: C.ink },
  sub: { fontSize: 14, color: C.sub, marginTop: 2, marginBottom: 16 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 14, ...shadow },
  section: { fontSize: 16, fontWeight: '800', color: C.ink, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', color: C.sub, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.ink, backgroundColor: C.bg },
  scanBtn: { backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 18, marginLeft: 8, justifyContent: 'center' },
  scanText: { fontWeight: '800', color: C.ink },
  two: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  thumbWrap: { marginRight: 8, marginBottom: 8 },
  thumb: { width: 76, height: 76, borderRadius: 10 },
  remove: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  camBtn: { flex: 1, backgroundColor: C.accent, paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginRight: 8 },
  camText: { fontWeight: '800', color: C.ink },
  galBtn: { flex: 1, backgroundColor: C.grayBg, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  galText: { fontWeight: '800', color: C.ink },
  hint: { fontSize: 12, color: C.sub, marginTop: 10 },
  notice: { backgroundColor: C.accentSoft, padding: 12, borderRadius: 10, marginBottom: 4 },
  noticeText: { color: C.amber, fontSize: 13, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontSize: 13, color: C.ink, fontWeight: '600' },
  save: { backgroundColor: C.ink, paddingVertical: 17, borderRadius: 14, alignItems: 'center', ...shadow },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  closeScan: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 14 },
});
