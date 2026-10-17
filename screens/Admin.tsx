import { useCallback, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { C, shadow } from '../lib/theme';
import { ui } from '../lib/ui';
import Screen from '../components/Screen';

export default function Admin() {
  const nav = useNavigation<any>();
  const { name } = useAuth();
  const [s, setS] = useState<any>(null);

  useFocusEffect(useCallback(() => {
    api.summary().then(setS).catch((e) => Alert.alert('Error', e.message));
  }, []));

  const stats: [string, any, string, () => void][] = [
    ['Products', s?.products, C.ink, () => nav.navigate('Stock')],
    ['Low stock', s?.low_stock, C.amber, () => nav.navigate('StockProducts', { filter: 'low' })],
    ['Out of stock', s?.out_of_stock, C.red, () => nav.navigate('StockProducts', { filter: 'out' })],
    ['To dispatch', s?.pending_deliveries, '#1D4ED8', () => nav.navigate('DeliveryList')],
    ['Out for delivery', s?.out_for_delivery, '#6D28D9', () => nav.navigate('DeliveryList')],
    ['Delivered today', s?.delivered_today, C.green, () => nav.navigate('DeliveryList')],
  ];
  const links: [string, string, string, string][] = [
    ['📦', 'Manage Stock', 'Browse by category, add stock, barcodes', 'Stock'],
    ['🚚', 'Deliveries', 'Create, assign and track deliveries', 'DeliveryList'],
    ['👥', 'Users & Roles', 'Add staff, set role and permissions', 'Users'],
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={ui.pad}>
        <Text style={ui.h1}>Admin Panel</Text>
        <Text style={ui.sub}>{name ? `Welcome, ${name}` : 'Stock, deliveries and users'}</Text>

        <View style={st.grid}>
          {stats.map(([label, val, color, go]) => (
            <TouchableOpacity key={label} style={st.stat} activeOpacity={0.8} onPress={go}>
              <Text style={[st.num, { color }]}>{val ?? '–'}</Text>
              <Text style={st.statLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={[ui.card, { marginTop: 4 }]}>
          <Text style={ui.muted}>Stock value (at cost price)</Text>
          <Text style={st.value}>₹{Math.round(s?.stock_value ?? 0).toLocaleString('en-IN')}</Text>
        </View>

        <Text style={st.section}>Manage</Text>
        {links.map(([icon, title, desc, route]) => (
          <TouchableOpacity key={route} style={[ui.card, ui.row]} activeOpacity={0.85} onPress={() => nav.navigate(route)}>
            <Text style={{ fontSize: 28, marginRight: 14 }}>{icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={ui.name}>{title}</Text>
              <Text style={ui.muted}>{desc}</Text>
            </View>
            <Text style={{ fontSize: 26, color: C.sub }}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  stat: { width: '48%', backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, ...shadow },
  num: { fontSize: 30, fontWeight: '800' },
  statLabel: { fontSize: 13, color: C.sub, fontWeight: '600', marginTop: 2 },
  value: { fontSize: 26, fontWeight: '800', color: C.ink, marginTop: 4 },
  section: { fontSize: 16, fontWeight: '800', color: C.ink, marginTop: 12, marginBottom: 10 },
});
