import { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, Switch, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { C } from '../lib/theme';
import { ui, roleInfo } from '../lib/ui';
import { AppUser, Role } from '../lib/types';
import { Pill } from '../components/ProductCard';
import Chips from '../components/Chips';
import Sheet from '../components/Sheet';

const blank = { email: '', password: '', full_name: '', phone: '', role: 'sales' as Role, active: true };

const PERMS = `ADMIN
Everything: stock, deliveries, users, roles, cost price and margin.

STORE PERSON
Browse stock, add and update stock, set exact counts, generate barcodes, add products and variants. Cannot see cost price. No deliveries.

SALESMAN
Scan and search products, view stock, record a sale, create deliveries and cancel their own pending ones. Cannot change stock.

DELIVERY
Only deliveries assigned to them: start, and mark delivered with a proof photo.`;

export default function Users() {
  const { session } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof blank) => (v: any) => setF((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    setRefreshing(true);
    try { setUsers(await api.users.list()); } catch (e: any) { Alert.alert('Error', e.message); }
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openNew() { setEditing(null); setF(blank); setOpen(true); }
  function openEdit(u: AppUser) {
    setEditing(u);
    setF({ email: u.email, password: '', full_name: u.full_name ?? '', phone: u.phone ?? '', role: u.role, active: u.active });
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    try {
      if (editing) {
        await api.users.update({ id: editing.id, role: f.role, full_name: f.full_name, phone: f.phone, active: f.active, password: f.password || undefined });
      } else {
        if (!f.email.trim() || f.password.length < 6) throw new Error('Enter an email and a password of 6+ characters');
        await api.users.create({ email: f.email, password: f.password, role: f.role, full_name: f.full_name, phone: f.phone });
      }
      setOpen(false);
      load();
    } catch (e: any) { Alert.alert('Could not save user', e.message); }
    setBusy(false);
  }

  const self = editing?.id === session?.user.id;
  return (
    <View style={ui.screen}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <TouchableOpacity style={[ui.btn, { backgroundColor: C.accent, marginTop: 0 }]} onPress={openNew}>
          <Text style={[ui.btnText, { color: C.ink }]}>+ Add user</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Alert.alert('What can each role do?', PERMS)}>
          <Text style={{ textAlign: 'center', color: '#1D4ED8', fontWeight: '800', marginTop: 12 }}>ℹ️ What can each role do?</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={users} keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={ui.card} activeOpacity={0.85} onPress={() => openEdit(item)}>
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={[ui.name, { flex: 1, marginRight: 8 }]} numberOfLines={1}>{item.full_name || item.email}</Text>
              <Pill {...roleInfo(item.role)} />
            </View>
            <Text style={ui.muted}>{item.email}{item.phone ? ` · ${item.phone}` : ''}</Text>
            {!item.active && <Text style={{ color: C.red, fontWeight: '800', marginTop: 6 }}>Disabled</Text>}
          </TouchableOpacity>
        )}
      />

      <Sheet visible={open} onClose={() => setOpen(false)} title={editing ? 'Edit user' : 'Add user'}>
        <Text style={ui.label}>Full name</Text>
        <TextInput style={ui.input} value={f.full_name} onChangeText={set('full_name')} placeholderTextColor={C.sub} />
        <Text style={ui.label}>Email</Text>
        <TextInput style={[ui.input, editing && { opacity: 0.6 }]} value={f.email} onChangeText={set('email')} editable={!editing}
          autoCapitalize="none" keyboardType="email-address" placeholderTextColor={C.sub} />
        <Text style={ui.label}>Phone</Text>
        <TextInput style={ui.input} value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholderTextColor={C.sub} />
        <Text style={ui.label}>{editing ? 'New password (leave empty to keep)' : 'Password (6+ characters)'}</Text>
        <TextInput style={ui.input} value={f.password} onChangeText={set('password')} secureTextEntry autoCapitalize="none" placeholderTextColor={C.sub} />
        <Text style={ui.label}>Role</Text>
        <Chips<Role> value={f.role} onChange={set('role')}
          options={[{ key: 'admin', label: 'Admin' }, { key: 'sales', label: 'Salesman' }, { key: 'store', label: 'Store person' }, { key: 'delivery', label: 'Delivery' }]} />
        {editing && (
          <View style={[ui.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
            <Text style={{ color: C.ink, fontWeight: '700' }}>Account active</Text>
            <Switch value={f.active} onValueChange={set('active')} />
          </View>
        )}
        {self && <Text style={[ui.muted, { marginBottom: 8 }]}>This is your own account: you cannot remove your admin access.</Text>}
        <TouchableOpacity style={[ui.btn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
          <Text style={ui.btnText}>{busy ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </Sheet>
    </View>
  );
}
