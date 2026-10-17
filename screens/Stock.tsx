import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { NO_CATEGORY } from '../lib/config';
import { C } from '../lib/theme';
import { ui } from '../lib/ui';
import { Pill, stockInfo } from '../components/ProductCard';

type Group = { key: string; name: string; total: number; units: number; low: number; out: number };

// Step 1 of Manage Stock: pick a category
export default function Stock() {
  const nav = useNavigation<any>();
  const isTab = useRoute().name === 'StockTab';
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const { data, error } = await supabase.from('products')
      .select('id,sku,name,stock,low_stock_level,category,barcode').order('name').limit(2000);
    if (error) Alert.alert('Error', error.message);
    setRows(data ?? []);
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const groups = useMemo(() => {
    const m = new Map<string, Group>();
    rows.forEach((r) => {
      const key = (r.category ?? '').trim() || NO_CATEGORY;
      const g = m.get(key) ?? { key, name: key === NO_CATEGORY ? 'Uncategorised' : key, total: 0, units: 0, low: 0, out: 0 };
      g.total++; g.units += r.stock;
      if (r.stock <= 0) g.out++; else if (r.stock <= (r.low_stock_level ?? 5)) g.low++;
      m.set(key, g);
    });
    return [...m.values()].sort((a, b) =>
      (a.key === NO_CATEGORY ? 1 : 0) - (b.key === NO_CATEGORY ? 1 : 0) || a.name.localeCompare(b.name));
  }, [rows]);

  const term = q.trim().toLowerCase();
  const found = term
    ? rows.filter((r) => `${r.name} ${r.sku} ${r.category ?? ''} ${r.barcode ?? ''}`.toLowerCase().includes(term))
    : [];

  return (
    <View style={[ui.screen, isTab && { paddingTop: insets.top }]}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        {isTab && <Text style={[ui.h1, { marginBottom: 12 }]}>Stock</Text>}
        <TextInput style={[ui.input, { marginBottom: 0 }]} placeholder="Search any product, SKU or barcode"
          placeholderTextColor={C.sub} value={q} onChangeText={setQ} />
      </View>

      {term ? (
        <FlatList
          data={found} keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={ui.empty}>No products found</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={[ui.card, ui.row]} activeOpacity={0.85} onPress={() => nav.navigate('Product', { id: item.id })}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={ui.name} numberOfLines={1}>{item.name}</Text>
                <Text style={ui.muted}>{item.sku} · {item.category || 'Uncategorised'}</Text>
              </View>
              <Pill {...stockInfo(item.stock, item.low_stock_level)} />
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={groups} keyExtractor={(g) => g.key}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
          ListHeaderComponent={
            <TouchableOpacity style={[ui.card, ui.row, { backgroundColor: C.ink }]} activeOpacity={0.85} onPress={() => nav.navigate('StockProducts')}>
              <Text style={{ fontSize: 28, marginRight: 14 }}>📦</Text>
              <View style={{ flex: 1 }}>
                <Text style={[ui.name, { color: '#fff' }]}>All products</Text>
                <Text style={[ui.muted, { color: '#CBD5E1' }]}>{rows.length} products in {groups.length} categories</Text>
              </View>
              <Text style={{ fontSize: 26, color: '#CBD5E1' }}>›</Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={<Text style={ui.empty}>No products yet. Add one from the Add Product tab.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={[ui.card, ui.row]} activeOpacity={0.85} onPress={() => nav.navigate('StockProducts', { category: item.key })}>
              <Text style={{ fontSize: 28, marginRight: 14 }}>🗂️</Text>
              <View style={{ flex: 1 }}>
                <Text style={ui.name}>{item.name}</Text>
                <Text style={ui.muted}>{item.total} product{item.total === 1 ? '' : 's'} · {item.units} units</Text>
                {(item.low > 0 || item.out > 0) && (
                  <View style={{ flexDirection: 'row', marginTop: 6 }}>
                    {item.low > 0 && <Pill label={`${item.low} low`} fg={C.amber} bg={C.amberBg} />}
                    {item.out > 0 && <Pill label={`${item.out} out`} fg={C.red} bg={C.redBg} />}
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 26, color: C.sub }}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
