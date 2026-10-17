import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, RefreshControl } from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { NO_CATEGORY } from '../lib/config';
import { C } from '../lib/theme';
import { ui } from '../lib/ui';
import { RootStackParamList } from '../lib/types';
import { Pill, stockInfo } from '../components/ProductCard';
import Chips from '../components/Chips';

type Filter = 'all' | 'low' | 'out';
const label = (r: any) => [r.color, r.size, r.wattage].filter(Boolean).join(' · ');

// Step 2 of Manage Stock:
//  - inside a category  -> list of MODELS (a model with one version opens straight to its details)
//  - inside a model     -> list of its VARIANTS (colour / size / wattage), tap one for details + barcode
//  - from the dashboard low/out cards -> flat list of variants
export default function StockProducts() {
  const nav = useNavigation<any>();
  const { role } = useAuth();
  const canAdd = role === 'admin' || role === 'store';
  const { params } = useRoute<RouteProp<RootStackParamList, 'StockProducts'>>();
  const cat = params?.category;
  const model = params?.model;
  const flat = !!model || !!params?.filter;
  const [filter, setFilter] = useState<Filter>(params?.filter ?? 'all');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    let query = supabase.from('products')
      .select('id,sku,name,model,category,color,size,wattage,price,stock,low_stock_level,barcode').order('name').limit(2000);
    if (cat === NO_CATEGORY) query = query.or('category.is.null,category.eq.');
    else if (cat) query = query.eq('category', cat);
    if (model) query = query.eq('model', model);
    const { data, error } = await query;
    if (error) Alert.alert('Error', error.message);
    setRows(data ?? []);
    setRefreshing(false);
  }, [cat, model]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = rows.filter((r) => {
    const low = r.low_stock_level ?? 5;
    const okFilter = filter === 'all' || (filter === 'out' ? r.stock <= 0 : r.stock > 0 && r.stock <= low);
    const okText = !q || `${r.name} ${r.model ?? ''} ${r.sku} ${r.barcode ?? ''}`.toLowerCase().includes(q.toLowerCase());
    return okFilter && okText;
  });

  const groups = useMemo(() => {
    const m = new Map<string, { key: string; title: string; category: string | null; model: string; items: any[] }>();
    shown.forEach((r) => {
      const mm = (r.model ?? '').trim();
      const key = mm ? `m:${r.category}|${mm}` : `s:${r.id}`;
      const g = m.get(key) ?? { key, title: mm || r.name, category: r.category, model: mm, items: [] };
      g.items.push(r);
      m.set(key, g);
    });
    return [...m.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [shown]);

  const addHere = () => nav.navigate('Tabs', {
    screen: 'Add',
    params: { category: cat && cat !== NO_CATEGORY ? cat : undefined, model },
  });

  return (
    <View style={ui.screen}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        {(cat || model) && canAdd && (
          <TouchableOpacity style={[ui.btn, { backgroundColor: C.accent, marginTop: 0, marginBottom: 12 }]} onPress={addHere}>
            <Text style={[ui.btnText, { color: C.ink }]}>{model ? '＋ Add another variant' : '＋ Add product / model here'}</Text>
          </TouchableOpacity>
        )}
        <TextInput style={ui.input} placeholder="Search name, model, SKU or barcode" placeholderTextColor={C.sub} value={q} onChangeText={setQ} />
        <Chips<Filter> value={filter} onChange={setFilter}
          options={[{ key: 'all', label: 'All' }, { key: 'low', label: 'Low stock' }, { key: 'out', label: 'Out of stock' }]} />
      </View>

      {flat ? (
        <FlatList
          data={shown} keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
          ListEmptyComponent={<Text style={ui.empty}>No products here</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={[ui.card, ui.row]} activeOpacity={0.85} onPress={() => nav.navigate('Product', { id: item.id })}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={ui.name} numberOfLines={2}>{model ? (label(item) || item.name) : item.name}</Text>
                <Text style={ui.muted}>
                  {item.sku}{model ? ` · ₹${item.price}` : item.category ? ` · ${item.category}` : ''}
                </Text>
                <Text style={[ui.muted, { color: item.barcode ? C.green : C.amber, fontWeight: '700' }]}>
                  {item.barcode ? '▮▯▮ Barcode ready' : 'No barcode yet'}
                </Text>
              </View>
              <Pill {...stockInfo(item.stock, item.low_stock_level)} />
              <Text style={{ fontSize: 24, color: C.sub, marginLeft: 6 }}>›</Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={groups} keyExtractor={(g) => g.key}
          contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
          ListEmptyComponent={<Text style={ui.empty}>No products here</Text>}
          renderItem={({ item: g }) => {
            const units = g.items.reduce((s, r) => s + r.stock, 0);
            const low = g.items.filter((r) => r.stock > 0 && r.stock <= (r.low_stock_level ?? 5)).length;
            const out = g.items.filter((r) => r.stock <= 0).length;
            const single = g.items.length === 1;
            return (
              <TouchableOpacity style={[ui.card, ui.row]} activeOpacity={0.85}
                onPress={() => single ? nav.navigate('Product', { id: g.items[0].id })
                  : nav.push('StockProducts', { category: g.category || NO_CATEGORY, model: g.model })}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={ui.name} numberOfLines={2}>{g.title}</Text>
                  <Text style={ui.muted}>
                    {single ? `${g.items[0].sku} · ${units} in stock` : `${g.items.length} variants · ${units} units`}
                  </Text>
                  {(low > 0 || out > 0) && (
                    <View style={{ flexDirection: 'row', marginTop: 6 }}>
                      {low > 0 && <Pill label={`${low} low`} fg={C.amber} bg={C.amberBg} />}
                      {out > 0 && <Pill label={`${out} out`} fg={C.red} bg={C.redBg} />}
                    </View>
                  )}
                </View>
                {single && <Pill {...stockInfo(g.items[0].stock, g.items[0].low_stock_level)} />}
                <Text style={{ fontSize: 24, color: C.sub, marginLeft: 6 }}>›</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
