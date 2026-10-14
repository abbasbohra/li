import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { s } from '../styles';

const FIELDS = ['sku', 'name', 'category', 'price', 'cost_price', 'stock', 'wattage', 'size', 'color', 'location', 'description'];

export default function Admin() {
  const [f, setF] = useState({});
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);

  async function addPhoto() {
    const r = await launchCamera({ mediaType: 'photo', includeBase64: true, quality: 0.4, maxWidth: 800, maxHeight: 800 });
    if (r.errorCode) return Alert.alert('Camera error', r.errorMessage || r.errorCode);
    if (!r.didCancel) setPhotos([...photos, r.assets[0]]);
  }

  async function save() {
    if (!f.sku || !f.name || photos.length === 0) return Alert.alert('Need SKU, name and at least 1 photo (3-5 is best)');
    setBusy(true);
    try {
      const { cost_price, ...rest } = f;
      const { data: p, error } = await supabase.from('products').insert({
        ...rest, price: +f.price || 0, stock: +f.stock || 0 }).select().single();
      if (error) throw error;
      if (cost_price) await supabase.from('product_costs').insert({ product_id: p.id, cost_price: +cost_price });

      for (const [i, ph] of photos.entries()) {
        const path = `${p.id}/${Date.now()}-${i}.jpg`;
        const up = await supabase.storage.from('product-images').upload(path, decode(ph.base64), { contentType: 'image/jpeg' });
        if (up.error) throw up.error;
        const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
        const emb = await supabase.functions.invoke('embed-image', { body: { image: ph.base64 } });
        if (emb.error || emb.data?.error) throw new Error(emb.error?.message || emb.data.error);
        await supabase.from('product_images').insert({ product_id: p.id, image_url: url, embedding: emb.data.embedding });
      }
      Alert.alert('Saved ✅'); setF({}); setPhotos([]);
    } catch (e) { Alert.alert('Error', e.message); }
    setBusy(false);
  }

  return (
    <ScrollView style={s.screen}>
      <Text style={s.h1}>Add Product</Text>
      {FIELDS.map((k) => (
        <TextInput key={k} style={s.input} placeholder={k.replace('_', ' ')} value={f[k] || ''}
          keyboardType={['price', 'cost_price', 'stock'].includes(k) ? 'numeric' : 'default'}
          onChangeText={(v) => setF({ ...f, [k]: v })} />
      ))}
      <TouchableOpacity style={s.btn} onPress={addPhoto}><Text style={s.btnText}>📷 Add photo ({photos.length})</Text></TouchableOpacity>
      <ScrollView horizontal>{photos.map((p, i) => <Image key={i} source={{ uri: p.uri }} style={s.thumb} />)}</ScrollView>
      <TouchableOpacity style={[s.bigBtn, { marginTop: 16 }]} onPress={save} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.bigBtnText}>Save Product</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}
