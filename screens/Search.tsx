import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { C, shadow } from '../lib/theme';
import { ProductRow } from '../lib/types';
import ProductCard from '../components/ProductCard';
import Screen from '../components/Screen';

const COLS = 'id,sku,name,price,stock,low_stock_level,category,product_images(image_url)';

export default function Search() {
  const nav = useNavigation<any>();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(async () => {
      const clean = q.trim().replace(/[,()%]/g, ' ');
      let query = supabase.from('products').select(COLS).limit(30);
      query = clean.length >= 1
        ? query.or(`name.ilike.%${clean}%,sku.ilike.%${clean}%,barcode.ilike.%${clean}%,category.ilike.%${clean}%,model.ilike.%${clean}%,color.ilike.%${clean}%,wattage.ilike.%${clean}%`)
        : query.order('created_at', { ascending: false });
      const { data } = await query;
      setRows((data ?? []).map((p: any) => ({ ...p, thumb: p.product_images?.[0]?.image_url })));
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <Screen>
      <View style={st.top}>
        <Text style={st.title}>Search</Text>
        <View style={st.bar}>
          <Text style={st.icon}>🔍</Text>
          <TextInput style={st.input} placeholder="Name, SKU, barcode, category, colour, watt" placeholderTextColor={C.sub}
            value={q} onChangeText={setQ} autoCorrect={false} returnKeyType="search" />
          {q.length > 0 && (
            <TouchableOpacity onPress={() => setQ('')} hitSlop={10}><Text style={st.clear}>✕</Text></TouchableOpacity>
          )}
        </View>
        <Text style={st.count}>
          {loading ? 'Searching…' : q ? `${rows.length} result${rows.length === 1 ? '' : 's'}` : 'Recently added'}
        </Text>
      </View>
      {loading && rows.length === 0 ? (
        <ActivityIndicator size="large" color={C.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(i) => i.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          renderItem={({ item }) => <ProductCard item={item} onPress={() => nav.navigate('Product', { id: item.id })} />}
          ListEmptyComponent={
            <View style={st.empty}>
              <Text style={{ fontSize: 40 }}>💡</Text>
              <Text style={st.emptyTitle}>No products found</Text>
              <Text style={st.emptyText}>Check the spelling or try a SKU.</Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: 16, paddingTop: 16 },
  title: { fontSize: 28, fontWeight: '800', color: C.ink, marginBottom: 12 },
  bar: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: C.line, ...shadow },
  icon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: C.ink },
  clear: { fontSize: 16, color: C.sub, paddingLeft: 8 },
  count: { fontSize: 13, color: C.sub, marginTop: 12, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.ink, marginTop: 8 },
  emptyText: { color: C.sub, marginTop: 4 },
});
