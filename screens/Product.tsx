import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  Share,
  StyleSheet,
} from 'react-native';
import {
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import BarcodeView from '../components/BarcodeView';
import { useAuth } from '../lib/auth';
import { C, shadow } from '../lib/theme';
import { RootStackParamList } from '../lib/types';
import { Pill, stockInfo } from '../components/ProductCard';
import StockSheet from '../components/StockSheet';
import Chips from '../components/Chips';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LABEL_SIZES, shareLabel } from '../lib/label';

export default function Product() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'Product'>>();
  const nav = useNavigation<any>();
  const [sibs, setSibs] = useState<any[]>([]);
  const { isAdmin, role } = useAuth();
  const canStock = role === 'admin' || role === 'store'; // add / update stock, barcode, variants
  const canSell = role === 'admin' || role === 'sales';
  const [p, setP] = useState<any>(null);
  const [imgs, setImgs] = useState<string[]>([]);
  const [cost, setCost] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [size, setSize] = useState('50x30'); // sticker size in mm, remembered on this phone
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem('labelSize')
      .then(v => v && setSize(v))
      .catch(() => {});
  }, []);
  const changeSize = (k: string) => {
    setSize(k);
    AsyncStorage.setItem('labelSize', k).catch(() => {});
  };

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('id', params.id)
      .single();
    setP(data);
    if (data?.model) {
      let sq = supabase
        .from('products')
        .select('id,sku,color,size,wattage,stock')
        .eq('model', data.model)
        .neq('id', data.id)
        .order('name');
      sq = data.category
        ? sq.eq('category', data.category)
        : sq.is('category', null);
      setSibs((await sq).data ?? []);
    } else setSibs([]);
    const im = await supabase
      .from('product_images')
      .select('image_url')
      .eq('product_id', params.id);
    setImgs((im.data ?? []).map((i: any) => i.image_url));
    if (isAdmin) {
      const c = await supabase
        .from('product_costs')
        .select('cost_price')
        .eq('product_id', params.id)
        .maybeSingle();
      setCost(c.data?.cost_price ?? null);
    }
  }, [params.id, isAdmin]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function change(qty: number, reason: string) {
    const { error } = await supabase.rpc('adjust_stock', {
      p_id: params.id,
      qty,
      p_reason: reason,
    });
    if (error) Alert.alert('Error', error.message);
    else load();
  }

  // Admin: attach another colour / size / wattage to this lamp model
  async function addVariant() {
    try {
      const model = p.model || p.name;
      if (!p.model)
        await supabase.from('products').update({ model }).eq('id', p.id); // this product becomes the first variant
      nav.navigate('Tabs', {
        screen: 'Add',
        params: { category: p.category ?? undefined, model },
      });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  async function makeBarcode() {
    try {
      await api.generateBarcode(params.id);
      load();
    } catch (e: any) {
      Alert.alert('Could not generate barcode', e.message);
    }
  }

  async function printLabel() {
    const [w, h] = size.split('x').map(Number);
    setPrinting(true);
    try {
      await shareLabel(
        { name: p.name, sku: p.sku, price: p.price, barcode: p.barcode },
        w,
        h,
      );
    } catch (e: any) {
      Alert.alert('Could not create label', e.message);
    }
    setPrinting(false);
  }

  if (!p) return <View style={st.screen} />;
  const rows: [string, string | null][] = [
    ['Model', p.model],
    ['SKU', p.sku],
    ['Barcode', p.barcode],
    ['Category', p.category],
    ['Wattage', p.wattage],
    ['Size', p.size],
    ['Colour', p.color],
    ['Shelf location', p.location],
  ];

  return (
    <ScrollView
      style={st.screen}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      {imgs.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {imgs.map((u, k) => (
            <Image key={k} source={{ uri: u }} style={st.photo} />
          ))}
        </ScrollView>
      )}
      <View style={st.card}>
        <Text style={st.name}>{p.name}</Text>
        <Text style={st.price}>₹{p.price}</Text>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <Pill {...stockInfo(p.stock, p.low_stock_level)} />
        </View>
      </View>

      <View style={st.card}>
        <Text style={st.section}>Details</Text>
        {rows
          .filter(r => r[1])
          .map(([k, v]) => (
            <View key={k} style={st.row}>
              <Text style={st.k}>{k}</Text>
              <Text style={st.v}>{v}</Text>
            </View>
          ))}
        {p.description ? <Text style={st.desc}>{p.description}</Text> : null}
      </View>

      {sibs.length > 0 && (
        <View style={st.card}>
          <Text style={st.section}>Other variants of {p.model}</Text>
          {sibs.map(s => (
            <TouchableOpacity
              key={s.id}
              style={st.row}
              onPress={() => nav.push('Product', { id: s.id })}
            >
              <Text style={st.k}>
                {[s.color, s.size, s.wattage].filter(Boolean).join(' · ') ||
                  s.sku}
              </Text>
              <Text style={st.v}>{s.stock} in stock ›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {canStock && (
        <View style={st.card}>
          <Text style={st.section}>Barcode label</Text>
          {p.barcode ? (
            <>
              <BarcodeView code={p.barcode} />
              <Text
                style={{
                  color: C.sub,
                  fontSize: 12,
                  textAlign: 'center',
                  marginTop: 10,
                }}
              >
                Choose the sticker size, then print or share the label to your
                label printer app.
              </Text>
              <Text
                style={{
                  color: C.sub,
                  fontSize: 12,
                  fontWeight: '700',
                  marginTop: 14,
                  marginBottom: 6,
                }}
              >
                Sticker size (mm)
              </Text>
              <Chips<string>
                value={size}
                onChange={changeSize}
                options={LABEL_SIZES.map(([w, h]) => ({
                  key: `${w}x${h}`,
                  label: `${w} × ${h}`,
                }))}
              />
              <TouchableOpacity
                style={[
                  st.btn,
                  { backgroundColor: C.accent, marginTop: 0 },
                  printing && { opacity: 0.6 },
                ]}
                onPress={printLabel}
                disabled={printing}
              >
                <Text style={[st.btnText, { color: C.ink }]}>
                  {printing ? 'Preparing…' : '🖨 Print sticker label'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Share.share({ message: p.barcode })}
              >
                <Text
                  style={{
                    color: '#1D4ED8',
                    fontWeight: '800',
                    textAlign: 'center',
                    marginTop: 10,
                  }}
                >
                  Share barcode number
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[st.btn, { backgroundColor: C.accent, marginTop: 0 }]}
              onPress={makeBarcode}
            >
              <Text style={[st.btnText, { color: C.ink }]}>
                ▮▯▮ Generate barcode
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isAdmin && cost !== null && (
        <View style={st.card}>
          <Text style={st.section}>Admin only</Text>
          <View style={st.row}>
            <Text style={st.k}>Cost price</Text>
            <Text style={st.v}>₹{cost}</Text>
          </View>
          <View style={st.row}>
            <Text style={st.k}>Margin</Text>
            <Text style={st.v}>₹{(p.price - cost).toFixed(0)}</Text>
          </View>
        </View>
      )}

      {canStock && (
        <TouchableOpacity
          style={{
            borderWidth: 1.5,
            borderColor: C.ink,
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: 'center',
            marginTop: 14,
          }}
          onPress={addVariant}
        >
          <Text style={{ fontWeight: '800', color: C.ink }}>
            ＋ Add another variant of this model
          </Text>
        </TouchableOpacity>
      )}

      <View style={{ flexDirection: 'row' }}>
        {canSell && (
          <TouchableOpacity
            style={[st.btn, { backgroundColor: C.ink }]}
            onPress={() => change(-1, 'sale')}
          >
            <Text style={st.btnText}>Sold 1</Text>
          </TouchableOpacity>
        )}
        {canStock && (
          <TouchableOpacity
            style={[st.btn, { backgroundColor: C.green, marginLeft: 10 }]}
            onPress={() => setSheet(true)}
          >
            <Text style={st.btnText}>＋ Add / Update Stock</Text>
          </TouchableOpacity>
        )}
      </View>
      {canStock && (
        <StockSheet
          product={sheet ? { id: p.id, name: p.name, stock: p.stock } : null}
          onClose={() => setSheet(false)}
          onSaved={load}
        />
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  photo: {
    width: 240,
    height: 240,
    borderRadius: 16,
    marginRight: 10,
    backgroundColor: C.grayBg,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
    ...shadow,
  },
  name: { fontSize: 22, fontWeight: '800', color: C.ink },
  price: { fontSize: 24, fontWeight: '800', color: C.ink, marginTop: 4 },
  section: { fontSize: 15, fontWeight: '800', color: C.ink, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  k: { color: C.sub, fontSize: 14 },
  v: {
    color: C.ink,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  desc: { color: C.sub, marginTop: 10, lineHeight: 20 },
  btn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
