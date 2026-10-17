import { ReactNode, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, RefreshControl, Alert, Modal } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { supabase, findDeliveryByBarcode } from '../lib/supabase';
import BarcodeScanner from '../components/BarcodeScanner';
import { useAuth } from '../lib/auth';
import { C } from '../lib/theme';
import { ui, statusInfo } from '../lib/ui';
import { Pill } from '../components/ProductCard';
import Chips from '../components/Chips';
import Screen from '../components/Screen';

type F = 'pending' | 'active' | 'done' | 'cancelled' | 'all';
const Plain = ({ children }: { children: ReactNode }) => <View style={ui.screen}>{children}</View>;

export default function Deliveries() {
  const nav = useNavigation<any>();
  const isTab = useRoute().name === 'Deliveries'; // tab for sales/delivery, stack screen for admin
  const { role } = useAuth();
  const [filter, setFilter] = useState<F>('active');
  const [rows, setRows] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const { data, error } = await supabase.from('deliveries')
      .select('id,customer_name,address,city,delivery_no,status,created_at,assigned_name,delivery_items(qty,product_name)')
      .order('created_at', { ascending: false }).limit(80);
    if (error) Alert.alert('Error', error.message);
    setRows(data ?? []);
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = rows.filter((d) =>
    filter === 'all' ? true :
    filter === 'pending' ? d.status === 'pending' :
    filter === 'active' ? ['pending', 'assigned', 'out_for_delivery'].includes(d.status) :
    filter === 'done' ? d.status === 'delivered' : d.status === 'cancelled');

  async function onParcel(code: string) {
    setScanOpen(false);
    try {
      const x = await findDeliveryByBarcode(code);
      if (x) nav.navigate('DeliveryDetail', { id: x.id });
      else Alert.alert('Not found', 'This parcel is not assigned to you, or the code is wrong.');
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  const Wrap = isTab ? Screen : Plain;
  return (
    <Wrap>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <View style={[ui.row, { justifyContent: 'space-between' }]}>
          {isTab ? <Text style={ui.h1}>Deliveries</Text> : <View />}
          {role === 'delivery' && (
            <TouchableOpacity style={{ backgroundColor: C.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }} onPress={() => setScanOpen(true)}>
              <Text style={{ fontWeight: '800', color: C.ink }}>▮▯▮ Scan parcel</Text>
            </TouchableOpacity>
          )}
          {role !== 'delivery' && (
            <TouchableOpacity style={{ backgroundColor: C.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }}
              onPress={() => nav.navigate('NewDelivery')}>
              <Text style={{ fontWeight: '800', color: C.ink }}>+ New</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={{ height: 12 }} />
        <Chips<F> value={filter} onChange={setFilter}
          options={[...(role === 'admin' ? [{ key: 'pending' as F, label: 'To assign' }] : []), { key: 'active', label: 'Active' }, { key: 'done', label: 'Delivered' }, { key: 'cancelled', label: 'Cancelled' }, { key: 'all', label: 'All' }]} />
      </View>
      <FlatList
        data={shown} keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<Text style={ui.empty}>No deliveries here</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={ui.card} activeOpacity={0.85} onPress={() => nav.navigate('DeliveryDetail', { id: item.id })}>
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={[ui.name, { flex: 1, marginRight: 8 }]} numberOfLines={1}>{item.customer_name}</Text>
              <Pill {...statusInfo(item.status)} />
            </View>
            <Text style={ui.muted} numberOfLines={1}>{item.delivery_no != null ? `#${item.delivery_no} · ` : ''}{item.address}{item.city ? `, ${item.city}` : ''}</Text>
            <Text style={{ color: C.ink, marginTop: 8 }} numberOfLines={2}>
              {item.delivery_items.map((i: any) => `${i.qty} × ${i.product_name}`).join(', ')}
            </Text>
            <Text style={ui.muted}>
              {new Date(item.created_at).toLocaleDateString('en-IN')}{item.assigned_name ? ` · ${item.assigned_name}` : ''}
            </Text>
          </TouchableOpacity>
        )}
      />
      <Modal visible={scanOpen} animationType="slide" onRequestClose={() => setScanOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <BarcodeScanner active={scanOpen} onScanned={onParcel} />
          <TouchableOpacity style={{ position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 14 }}
            onPress={() => setScanOpen(false)}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </Wrap>
  );
}
