import { useEffect, useState } from 'react';
import { ScrollView, View, Text, Image, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { s } from '../styles';

export default function Product({ id, isAdmin, onBack }) {
  const [p, setP] = useState(null);
  const [imgs, setImgs] = useState([]);
  const [cost, setCost] = useState(null);

  async function load() {
    const { data } = await supabase.from('products').select('*').eq('id', id).single();
    setP(data);
    const im = await supabase.from('product_images').select('image_url').eq('product_id', id);
    setImgs(im.data || []);
    if (isAdmin) {
      const c = await supabase.from('product_costs').select('cost_price').eq('product_id', id).maybeSingle();
      setCost(c.data?.cost_price ?? null);
    }
  }
  useEffect(() => { load(); }, [id]);

  async function change(qty, reason) {
    const { error } = await supabase.rpc('adjust_stock', { p_id: id, qty, p_reason: reason });
    if (error) Alert.alert('Error', error.message); else load();
  }

  if (!p) return null;
  const rows = [['SKU', p.sku], ['Category', p.category], ['Wattage', p.wattage], ['Size', p.size],
    ['Colour', p.color], ['Location', p.location]];
  return (
    <ScrollView style={s.screen}>
      <TouchableOpacity onPress={onBack}><Text style={s.link}>← Back</Text></TouchableOpacity>
      <ScrollView horizontal>{imgs.map((i, k) => <Image key={k} source={{ uri: i.image_url }} style={s.photo} />)}</ScrollView>
      <Text style={s.h1}>{p.name}</Text>
      <Text style={s.price}>₹{p.price}</Text>
      <Text style={[s.stock, p.stock <= p.low_stock_level && { color: 'red' }]}>
        In stock: {p.stock} {p.stock <= p.low_stock_level ? '(LOW)' : ''}
      </Text>
      {rows.filter((r) => r[1]).map(([k, v]) => <Text key={k} style={s.row}>{k}: <Text style={{ fontWeight: '600' }}>{v}</Text></Text>)}
      {p.description ? <Text style={s.row}>{p.description}</Text> : null}
      {isAdmin && cost !== null && <Text style={s.row}>Cost: ₹{cost} • Margin: ₹{(p.price - cost).toFixed(0)}</Text>}
      <View style={s.btnRow}>
        <TouchableOpacity style={s.btn} onPress={() => change(-1, 'sale')}><Text style={s.btnText}>Sold 1</Text></TouchableOpacity>
        {isAdmin && <TouchableOpacity style={[s.btn, { backgroundColor: '#2e7d32' }]} onPress={() => change(10, 'purchase')}><Text style={s.btnText}>+10 Stock</Text></TouchableOpacity>}
      </View>
    </ScrollView>
  );
}
