import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, Alert, Linking, ActivityIndicator, Image } from 'react-native';
import { launchCamera, Asset } from 'react-native-image-picker';
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ensureCameraPermission } from '../lib/camera';
import { Coords, DELIVERY_RADIUS_M, directionsUrl, distanceM, fmtDist, getCurrentCoords, mapsUrl } from '../lib/location';
import { C } from '../lib/theme';
import { ui, statusInfo } from '../lib/ui';
import { AppUser, RootStackParamList } from '../lib/types';
import { Pill } from '../components/ProductCard';
import Sheet from '../components/Sheet';
import BarcodeView from '../components/BarcodeView';
import LocationPicker from '../components/LocationPicker';

export default function DeliveryDetail() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'DeliveryDetail'>>();
  const { role, session } = useAuth();
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState(false);
  const [staff, setStaff] = useState<AppUser[] | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const [photo, setPhoto] = useState<Asset | null>(null);
  const [note, setNote] = useState('');
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [me, setMe] = useState<Coords | null>(null);       // delivery person's current position
  const [locBusy, setLocBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('deliveries').select('*, delivery_items(*)').eq('id', params.id).single();
    if (error) Alert.alert('Error', error.message);
    setD(data);
    setProofUrl(null);
    if (data?.proof_path) {
      const { data: s } = await supabase.storage.from('delivery-proofs').createSignedUrl(data.proof_path, 3600);
      setProofUrl(s?.signedUrl ?? null);
    }
  }, [params.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function checkLocation() {
    setLocBusy(true);
    try { setMe(await getCurrentCoords()); } catch (e: any) { Alert.alert('Location', e.message); }
    setLocBusy(false);
  }
  // delivery person: check position automatically once the delivery is on the way
  useEffect(() => {
    if (role === 'delivery' && d?.lat != null && d?.status === 'out_for_delivery') checkLocation();
  }, [d?.id, d?.status]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); await load(); } catch (e: any) { Alert.alert('Not done', e.message); }
    setBusy(false);
  }

  async function openAssign() {
    setPick(true);
    if (staff) return;
    try { setStaff((await api.users.list()).filter((u) => u.role === 'delivery' && u.active)); }
    catch (e: any) { Alert.alert('Error', e.message); setPick(false); }
  }

  async function takePhoto() {
    if (!(await ensureCameraPermission())) return Alert.alert('Camera permission needed');
    const r = await launchCamera({ mediaType: 'photo', includeBase64: true, quality: 0.5, maxWidth: 1024, maxHeight: 1024 });
    if (r.didCancel) return;
    if (r.errorCode) return Alert.alert('Camera error', r.errorMessage || r.errorCode);
    setPhoto(r.assets?.[0] ?? null);
  }

  async function confirmDelivered() {
    if (role === 'delivery' && !photo) return Alert.alert('Take a photo of the delivered goods first');
    setBusy(true);
    try {
      let here: Coords | null = null;
      if (role === 'delivery' && d.lat != null) {            // must be at the delivery location
        here = await getCurrentCoords();
        const far = distanceM(here, { lat: d.lat, lng: d.lng });
        if (far > DELIVERY_RADIUS_M) throw new Error(`You are ${fmtDist(far)} away from the delivery location. Reach the place first.`);
      }
      let path: string | undefined;
      if (photo?.base64) {
        path = `${d.id}/${Date.now()}.jpg`;
        const up = await supabase.storage.from('delivery-proofs').upload(path, decode(photo.base64), { contentType: 'image/jpeg' });
        if (up.error) throw up.error;
      }
      await api.setDeliveryStatus(d.id, 'delivered', path, note.trim() || undefined, here?.lat, here?.lng);
      setProofOpen(false); setPhoto(null); setNote('');
      await load();
    } catch (e: any) { Alert.alert('Could not complete delivery', e.message); }
    setBusy(false);
  }

  if (!d) return <View style={ui.screen}><ActivityIndicator style={{ marginTop: 40 }} color={C.accent} /></View>;

  const target: Coords | null = d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : null;
  const fullAddr = [d.address, d.landmark ? `Near ${d.landmark}` : '', d.city, d.pincode].filter(Boolean).join(', ');
  const open = !['delivered', 'cancelled'].includes(d.status);
  const mine = d.assigned_to === session?.user.id;
  const dist = me && target ? distanceM(me, target) : null;
  const needsGeo = role === 'delivery' && !!target;
  const near = dist != null && dist <= DELIVERY_RADIUS_M;
  const canAssign = role === 'admin' && ['pending', 'assigned'].includes(d.status);
  const canStart = open && d.status === 'assigned' && (role === 'admin' || (role === 'delivery' && mine));
  const canFinish = open && d.status === 'out_for_delivery' && (role === 'admin' || (role === 'delivery' && mine));
  const canCancel = open && (role === 'admin' || (role === 'sales' && d.created_by === session?.user.id && d.status === 'pending'));
  const canSetLoc = open && (role === 'admin' || (role === 'sales' && d.created_by === session?.user.id));
  const total = d.delivery_items.reduce((s: number, i: any) => s + i.qty * i.price, 0);
  const units = d.delivery_items.reduce((s: number, i: any) => s + i.qty, 0);

  function finish() {
    if (needsGeo && !near) {
      return Alert.alert('Reach the delivery location first',
        dist != null ? `You are ${fmtDist(dist)} away. You need to be within ${DELIVERY_RADIUS_M} m.` : 'Tap "Refresh my location" to check where you are.');
    }
    setProofOpen(true);
  }

  const Btn = ({ label, onPress, color = C.ink, off = false }: { label: string; onPress: () => void; color?: string; off?: boolean }) => (
    <TouchableOpacity style={[ui.btn, { backgroundColor: off ? C.gray : color }, (busy || off) && { opacity: 0.55 }]} onPress={onPress} disabled={busy}>
      <Text style={ui.btnText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.pad}>
      <View style={ui.card}>
        <View style={[ui.row, { justifyContent: 'space-between' }]}>
          <Text style={[ui.h1, { fontSize: 22, flex: 1 }]}>{d.customer_name}</Text>
          <Pill {...statusInfo(d.status)} />
        </View>
        {d.delivery_no != null && <Text style={ui.muted}>Delivery #{d.delivery_no}</Text>}
        {d.customer_phone ? (
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${d.customer_phone}`)}>
            <Text style={{ color: '#1D4ED8', fontWeight: '700', marginTop: 8 }}>📞 {d.customer_phone}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => Linking.openURL(target ? mapsUrl(target) : directionsUrl(null, fullAddr))}>
          <Text style={{ color: '#1D4ED8', fontWeight: '700', marginTop: 6 }}>📍 {fullAddr}</Text>
        </TouchableOpacity>
        {d.notes ? <Text style={[ui.muted, { marginTop: 8 }]}>Note: {d.notes}</Text> : null}
      </View>

      <View style={ui.card}>
        <Text style={[ui.name, { marginBottom: 6 }]}>Products ({d.delivery_items.length}) · {units} items</Text>
        {d.delivery_items.map((i: any) => (
          <View key={i.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={{ color: C.ink, fontWeight: '700', flex: 1, marginRight: 8 }}>{i.product_name}</Text>
              <Text style={{ color: C.ink, fontWeight: '800' }}>× {i.qty}</Text>
            </View>
            <Text style={ui.muted}>{[i.model && `Model: ${i.model}`, i.variant, i.sku].filter(Boolean).join(' · ')}</Text>
            <Text style={ui.muted}>₹{i.price} each · ₹{i.qty * i.price}</Text>
          </View>
        ))}
        <Text style={{ textAlign: 'right', fontSize: 18, fontWeight: '800', color: C.ink, marginTop: 10 }}>Total ₹{total}</Text>
      </View>

      <View style={ui.card}>
        <Text style={[ui.name, { marginBottom: 6 }]}>Delivery location</Text>
        {target ? (
          <>
            <Text style={{ color: C.green, fontWeight: '800' }}>📍 Location set</Text>
            {role === 'delivery' && open && d.status === 'out_for_delivery' && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ color: near ? C.green : C.amber, fontWeight: '800' }}>
                  {dist == null ? 'Checking your position…'
                    : near ? `✅ You have reached the location (${fmtDist(dist)})`
                    : `⛔ ${fmtDist(dist)} away. Get within ${DELIVERY_RADIUS_M} m to mark delivered`}
                </Text>
                <TouchableOpacity onPress={checkLocation} disabled={locBusy}>
                  <Text style={{ color: '#1D4ED8', fontWeight: '800', marginTop: 8 }}>{locBusy ? 'Checking…' : '↻ Refresh my location'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <Text style={ui.muted}>No exact location saved{role === 'delivery' ? '. You can mark delivered without it.' : '.'}</Text>
        )}
        {open && (
          <TouchableOpacity style={[ui.btn, { backgroundColor: '#1D4ED8', marginTop: 12 }]} onPress={() => Linking.openURL(directionsUrl(target, fullAddr))}>
            <Text style={ui.btnText}>🧭 Navigate</Text>
          </TouchableOpacity>
        )}
        {canSetLoc && (
          <TouchableOpacity onPress={() => setLocOpen(true)}>
            <Text style={{ color: '#1D4ED8', fontWeight: '800', marginTop: 12, textAlign: 'center' }}>{target ? 'Change location' : '＋ Add location'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {d.barcode && (
        <View style={ui.card}>
          <Text style={[ui.name, { marginBottom: 10 }]}>Delivery barcode</Text>
          <BarcodeView code={d.barcode} />
          <Text style={[ui.muted, { textAlign: 'center', marginTop: 8 }]}>Stick this on the parcel. Scanning it opens this delivery.</Text>
        </View>
      )}

      <View style={ui.card}>
        <Text style={ui.muted}>Created by {d.created_by_name ?? 'staff'} · {new Date(d.created_at).toLocaleString('en-IN')}</Text>
        <Text style={ui.muted}>Delivery person: {d.assigned_name ?? 'not assigned yet'}</Text>
        {d.delivered_at ? <Text style={ui.muted}>Delivered: {new Date(d.delivered_at).toLocaleString('en-IN')}</Text> : null}
      </View>

      {d.status === 'delivered' && (d.proof_path || d.delivery_note) && (
        <View style={ui.card}>
          <Text style={[ui.name, { marginBottom: 8 }]}>Proof of delivery</Text>
          {d.proof_path && (proofUrl
            ? <Image source={{ uri: proofUrl }} style={{ width: '100%', height: 220, borderRadius: 12 }} resizeMode="cover" />
            : <ActivityIndicator color={C.accent} />)}
          {d.delivery_note ? <Text style={[ui.muted, { marginTop: 8 }]}>Note: {d.delivery_note}</Text> : null}
        </View>
      )}

      {canAssign && <Btn label={d.assigned_name ? 'Change delivery person' : 'Assign delivery person'} onPress={openAssign} color="#1D4ED8" />}
      {canStart && <Btn label="Start delivery (out for delivery)" onPress={() => run(() => api.setDeliveryStatus(d.id, 'out_for_delivery'))} color="#6D28D9" />}
      {canFinish && <Btn label={needsGeo && !near ? 'Reach the location to mark delivered' : 'Mark as delivered (with photo)'} onPress={finish} color={C.green} off={needsGeo && !near} />}
      {canCancel && (
        <Btn label="Cancel delivery & restore stock" color={C.red}
          onPress={() => Alert.alert('Cancel delivery?', 'The items go back into stock.', [
            { text: 'No', style: 'cancel' },
            { text: 'Yes, cancel', style: 'destructive', onPress: () => run(() => api.cancelDelivery(d.id)) },
          ])} />
      )}

      <Sheet visible={proofOpen} onClose={() => setProofOpen(false)} title="Proof of delivery">
        <Text style={[ui.muted, { marginBottom: 10 }]}>
          {role === 'delivery' ? 'Take a photo of the delivered goods (required).' : 'Add a photo of the delivered goods (optional).'}
        </Text>
        {photo ? <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 220, borderRadius: 12, marginBottom: 10 }} resizeMode="cover" /> : null}
        <TouchableOpacity style={[ui.btn, { backgroundColor: C.accent, marginTop: 0 }]} onPress={takePhoto}>
          <Text style={[ui.btnText, { color: C.ink }]}>{photo ? '📷 Retake photo' : '📷 Take photo'}</Text>
        </TouchableOpacity>
        <Text style={[ui.label, { marginTop: 14 }]}>Note (optional)</Text>
        <TextInput style={ui.input} value={note} onChangeText={setNote} placeholder="e.g. Received by customer's wife" placeholderTextColor={C.sub} />
        <Btn label={busy ? 'Saving…' : 'Confirm delivered'} onPress={confirmDelivered} color={C.green} />
      </Sheet>

      <Sheet visible={locOpen} onClose={() => setLocOpen(false)} title="Delivery location">
        <LocationPicker value={null} onChange={(c) => { if (!c) return; setLocOpen(false); run(() => api.setDeliveryLocation(d.id, c.lat, c.lng)); }} />
      </Sheet>

      <Sheet visible={pick} onClose={() => setPick(false)} title="Choose delivery person">
        {!staff ? <ActivityIndicator color={C.accent} /> : staff.length === 0 ? (
          <Text style={ui.empty}>No delivery users yet. Add one in Admin → Users & Roles.</Text>
        ) : staff.map((u) => (
          <TouchableOpacity key={u.id} style={[ui.card, { marginBottom: 8 }]}
            onPress={() => { setPick(false); run(() => api.assignDelivery(d.id, u.id)); }}>
            <Text style={ui.name}>{u.full_name || u.email}</Text>
            <Text style={ui.muted}>{u.phone || u.email}</Text>
          </TouchableOpacity>
        ))}
      </Sheet>
    </ScrollView>
  );
}
