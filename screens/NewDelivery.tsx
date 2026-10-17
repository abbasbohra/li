import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { NO_CATEGORY } from '../lib/config';
import { Coords } from '../lib/location';
import { C } from '../lib/theme';
import { ui } from '../lib/ui';
import { AppUser } from '../lib/types';
import Chips from '../components/Chips';
import LocationPicker from '../components/LocationPicker';
import BarcodeScanner from '../components/BarcodeScanner';

type Prod = {
  id: string;
  name: string;
  model: string | null;
  category: string | null;
  sku: string;
  barcode: string | null;
  color: string | null;
  size: string | null;
  wattage: string | null;
  price: number;
  stock: number;
};
type Item = {
  id: string;
  name: string;
  model: string | null;
  sku: string;
  variant: string;
  price: number;
  stock: number;
  qty: number;
};

const COLS =
  'id,name,model,category,sku,barcode,color,size,wattage,price,stock';
const variantOf = (p: Prod) =>
  [p.color, p.size, p.wattage].filter(Boolean).join(' · ');
const catKey = (p: Prod) => (p.category ?? '').trim() || NO_CATEGORY;
const modelKey = (p: Prod) => (p.model ?? '').trim() || p.name; // a product without a model counts as its own model

export default function NewDelivery() {
  const nav = useNavigation<any>();
  const { role } = useAuth();
  const [f, setF] = useState({
    name: '',
    phone: '',
    address: '',
    landmark: '',
    city: '',
    pincode: '',
    notes: '',
  });
  const [loc, setLoc] = useState<Coords | null>(null);
  const [catalog, setCatalog] = useState<Prod[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [model, setModel] = useState('');
  const [selId, setSelId] = useState('');
  const [qty, setQty] = useState('1');
  const [cart, setCart] = useState<Item[]>([]);
  const [staff, setStaff] = useState<AppUser[]>([]);
  const [assignTo, setAssignTo] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) =>
    setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    supabase
      .from('products')
      .select(COLS)
      .order('name')
      .limit(2000)
      .then(({ data, error }) => {
        if (error) Alert.alert('Could not load products', error.message);
        setCatalog((data ?? []) as Prod[]);
      });
  }, []);
  useEffect(() => {
    if (role !== 'admin') return;
    api.users
      .list()
      .then(u => setStaff(u.filter(x => x.role === 'delivery' && x.active)))
      .catch(() => {});
  }, [role]);

  // step-by-step picker: category -> model -> variant
  const categories = useMemo(() => {
    const keys = Array.from(new Set(catalog.map(catKey)));
    return keys
      .sort(
        (a, b) =>
          (a === NO_CATEGORY ? 1 : 0) - (b === NO_CATEGORY ? 1 : 0) ||
          a.localeCompare(b),
      )
      .map(k => ({ key: k, label: k === NO_CATEGORY ? 'Uncategorised' : k }));
  }, [catalog]);
  const models = useMemo(
    () =>
      Array.from(
        new Set(catalog.filter(p => catKey(p) === category).map(modelKey)),
      ).sort(),
    [catalog, category],
  );
  const variants = useMemo(
    () => catalog.filter(p => catKey(p) === category && modelKey(p) === model),
    [catalog, category, model],
  );
  const sel = catalog.find(p => p.id === selId) ?? null;
  const selQty = parseInt(qty, 10) || 0;

  const term = q.trim().toLowerCase();
  const found =
    term.length < 2
      ? []
      : catalog
          .filter(p =>
            `${p.name} ${p.model ?? ''} ${p.sku} ${p.barcode ?? ''}`
              .toLowerCase()
              .includes(term),
          )
          .slice(0, 8);

  function choose(p: Prod) {
    // from search or barcode scan: fills the pickers below
    if (p.stock <= 0)
      return Alert.alert('Out of stock', `${p.name} has no stock.`);
    setCategory(catKey(p));
    setModel(modelKey(p));
    setSelId(p.id);
    setQty('1');
    setQ('');
  }
  function pickCategory(k: string) {
    setCategory(k);
    setModel('');
    setSelId('');
  }
  function pickModel(m: string) {
    setModel(m);
    setQty('1');
    const vs = catalog.filter(p => catKey(p) === category && modelKey(p) === m);
    setSelId(vs.length === 1 && vs[0].stock > 0 ? vs[0].id : ''); // single version: select it straight away
  }
  function pickVariant(p: Prod) {
    if (p.stock <= 0)
      return Alert.alert('Out of stock', `${p.name} has no stock.`);
    setSelId(p.id);
    setQty('1');
  }
  const bump = (d: number) =>
    setQty(
      String(
        Math.max(1, Math.min(sel?.stock ?? 1, (parseInt(qty, 10) || 0) + d)),
      ),
    );

  function addToCart() {
    if (!sel) return Alert.alert('Choose a product first');
    if (selQty < 1) return Alert.alert('Enter the quantity');
    const inCart = cart.find(i => i.id === sel.id)?.qty ?? 0;
    if (inCart + selQty > sel.stock) {
      return Alert.alert(
        'Not enough stock',
        `Only ${sel.stock} available${
          inCart ? ` (${inCart} already added)` : ''
        }.`,
      );
    }
    setCart(c =>
      inCart
        ? c.map(i => (i.id === sel.id ? { ...i, qty: i.qty + selQty } : i))
        : [
            ...c,
            {
              id: sel.id,
              name: sel.name,
              model: sel.model,
              sku: sel.sku,
              variant: variantOf(sel),
              price: sel.price,
              stock: sel.stock,
              qty: selQty,
            },
          ],
    );
    setSelId('');
    setQty('1'); // category and model stay, so the next variant is quick to add
  }

  const setItemQty = (id: string, v: string) =>
    setCart(c =>
      c.map(i =>
        i.id === id
          ? { ...i, qty: parseInt(v.replace(/\D/g, ''), 10) || 0 }
          : i,
      ),
    );
  const fixItemQty = (id: string) =>
    setCart(c =>
      c.map(i =>
        i.id === id ? { ...i, qty: Math.max(1, Math.min(i.stock, i.qty)) } : i,
      ),
    );
  const remove = (id: string) => setCart(c => c.filter(i => i.id !== id));
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  function onScan(code: string) {
    setScanOpen(false);
    const p = catalog.find(x => x.barcode === code.trim());
    if (!p) return Alert.alert('Not found', `No product has barcode ${code}.`);
    choose(p);
  }

  async function submit() {
    if (!f.name.trim() || !f.address.trim())
      return Alert.alert('Customer name and address are required');
    if (f.pincode && !/^\d{6}$/.test(f.pincode))
      return Alert.alert('Pincode must be 6 digits');
    if (cart.length === 0) return Alert.alert('Add at least one product');
    const bad = cart.find(i => i.qty < 1 || i.qty > i.stock);
    if (bad)
      return Alert.alert(
        'Check the quantity',
        `${bad.name}: enter a quantity from 1 to ${bad.stock}.`,
      );
    setBusy(true);
    try {
      const id = await api.createDelivery(
        { ...f, lat: loc?.lat, lng: loc?.lng, assignTo: assignTo || undefined },
        cart.map(i => ({ product_id: i.id, qty: i.qty })),
      );
      nav.replace('DeliveryDetail', { id });
    } catch (e: any) {
      Alert.alert('Could not create delivery', e.message);
    }
    setBusy(false);
  }

  const inp = (label: string, k: keyof typeof f, extra: object = {}) => (
    <View>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        style={ui.input}
        value={f[k]}
        onChangeText={set(k)}
        placeholderTextColor={C.sub}
        {...extra}
      />
    </View>
  );
  const info = (k: string, v: string | number | null | undefined) =>
    v ? (
      <View
        style={[
          ui.row,
          { justifyContent: 'space-between', paddingVertical: 4 },
        ]}
      >
        <Text style={ui.muted}>{k}</Text>
        <Text
          style={{
            color: C.ink,
            fontWeight: '700',
            flexShrink: 1,
            textAlign: 'right',
            marginLeft: 12,
          }}
        >
          {v}
        </Text>
      </View>
    ) : null;

  return (
    <ScrollView
      style={ui.screen}
      contentContainerStyle={ui.pad}
      keyboardShouldPersistTaps="handled"
    >
      <View style={ui.card}>
        <Text style={[ui.name, { marginBottom: 10 }]}>
          1. Customer and address
        </Text>
        {inp('Customer name *', 'name')}
        {inp('Phone', 'phone', { keyboardType: 'phone-pad' })}
        {inp('Address (house / shop, street, area) *', 'address', {
          multiline: true,
          style: [ui.input, { height: 80, textAlignVertical: 'top' }],
        })}
        {inp('Landmark', 'landmark', { placeholder: 'e.g. Near City Mall' })}
        <View style={ui.row}>
          <View style={{ flex: 1, marginRight: 8 }}>{inp('City', 'city')}</View>
          <View style={{ flex: 1 }}>
            {inp('Pincode', 'pincode', {
              keyboardType: 'numeric',
              maxLength: 6,
            })}
          </View>
        </View>
      </View>

      <View style={ui.card}>
        <Text style={[ui.name, { marginBottom: 10 }]}>
          2. Delivery location
        </Text>
        <LocationPicker value={loc} onChange={setLoc} />
        <Text style={[ui.muted, { marginTop: 8 }]}>
          With a location saved, the delivery person can only mark it delivered
          after reaching the place.
        </Text>
      </View>

      <View style={ui.card}>
        <Text style={[ui.name, { marginBottom: 10 }]}>
          3. Add product to deliver
        </Text>

        <Text style={ui.label}>Quick find</Text>
        <View style={ui.row}>
          <TextInput
            style={[ui.input, { flex: 1, marginBottom: 0 }]}
            value={q}
            onChangeText={setQ}
            placeholder="Name, model, SKU or barcode"
            placeholderTextColor={C.sub}
          />
          <TouchableOpacity
            style={{
              backgroundColor: C.accent,
              borderRadius: 10,
              paddingHorizontal: 14,
              marginLeft: 8,
              justifyContent: 'center',
            }}
            onPress={() => setScanOpen(true)}
          >
            <Text style={{ fontWeight: '800', color: C.ink }}>▮ Scan</Text>
          </TouchableOpacity>
        </View>
        {found.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[
              ui.row,
              {
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: C.line,
              },
            ]}
            onPress={() => choose(p)}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.ink, fontWeight: '700' }}>{p.name}</Text>
              <Text style={ui.muted}>
                {[p.model, variantOf(p), p.sku].filter(Boolean).join(' · ')} ·{' '}
                {p.stock > 0 ? `${p.stock} in stock` : 'out of stock'}
              </Text>
            </View>
            <Text style={{ color: C.ink, fontWeight: '800' }}>Select</Text>
          </TouchableOpacity>
        ))}

        <Text style={[ui.label, { marginTop: 16 }]}>Category</Text>
        <Chips<string>
          value={category}
          onChange={pickCategory}
          options={categories}
        />

        {category !== '' && (
          <>
            <Text style={ui.label}>Model</Text>
            <Chips<string>
              value={model}
              onChange={pickModel}
              options={models.map(m => ({ key: m, label: m }))}
            />
          </>
        )}

        {model !== '' && variants.length > 1 && (
          <>
            <Text style={ui.label}>Variant (colour · size · wattage)</Text>
            <View style={ui.chips}>
              {variants.map(p => {
                const on = p.id === selId,
                  out = p.stock <= 0;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[ui.chip, on && ui.chipOn, out && { opacity: 0.45 }]}
                    onPress={() => pickVariant(p)}
                  >
                    <Text style={[ui.chipText, on && ui.chipTextOn]}>
                      {variantOf(p) || p.sku} ·{' '}
                      {out ? 'out' : `${p.stock} left`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {sel && (
          <View
            style={{
              backgroundColor: C.bg,
              borderRadius: 12,
              padding: 12,
              marginTop: 4,
            }}
          >
            <Text style={[ui.label, { marginBottom: 6 }]}>
              Selected product
            </Text>
            {info('Product', sel.name)}
            {info('Model', sel.model)}
            {info('Variant', variantOf(sel))}
            {info('SKU', sel.sku)}
            {info('Price', `₹${sel.price}`)}
            {info('Available', `${sel.stock} in stock`)}

            <Text style={[ui.label, { marginTop: 12 }]}>Quantity</Text>
            <View style={ui.row}>
              <TouchableOpacity onPress={() => bump(-1)} style={qb}>
                <Text style={qt}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={[
                  ui.input,
                  {
                    width: 80,
                    marginBottom: 0,
                    textAlign: 'center',
                    fontWeight: '800',
                    marginHorizontal: 6,
                  },
                ]}
                value={qty}
                onChangeText={v => setQty(v.replace(/\D/g, ''))}
                keyboardType="numeric"
              />
              <TouchableOpacity onPress={() => bump(1)} style={qb}>
                <Text style={qt}>+</Text>
              </TouchableOpacity>
              <Text
                style={{
                  flex: 1,
                  textAlign: 'right',
                  fontSize: 16,
                  fontWeight: '800',
                  color: C.ink,
                }}
              >
                ₹{selQty * sel.price}
              </Text>
            </View>
            <TouchableOpacity
              style={[ui.btn, { backgroundColor: C.green }]}
              onPress={addToCart}
            >
              <Text style={ui.btnText}>＋ Add to delivery</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={ui.card}>
        <Text style={[ui.name, { marginBottom: 4 }]}>
          Products in this delivery
        </Text>
        <Text style={ui.muted}>
          {cart.length} product{cart.length === 1 ? '' : 's'} ·{' '}
          {cart.reduce((s, i) => s + i.qty, 0)} items
        </Text>
        {cart.length === 0 && (
          <Text style={[ui.empty, { marginTop: 14, marginBottom: 6 }]}>
            Nothing added yet
          </Text>
        )}
        {cart.map(i => (
          <View
            key={i.id}
            style={{
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: C.line,
            }}
          >
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text
                style={{
                  color: C.ink,
                  fontWeight: '700',
                  flex: 1,
                  marginRight: 8,
                }}
              >
                {i.name}
              </Text>
              <TouchableOpacity onPress={() => remove(i.id)} hitSlop={10}>
                <Text style={{ color: C.red, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={ui.muted}>
              {[i.model && `Model: ${i.model}`, i.variant, i.sku]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <View style={[ui.row, { marginTop: 8 }]}>
              <Text style={ui.muted}>Qty</Text>
              <TextInput
                style={[
                  ui.input,
                  {
                    width: 70,
                    marginBottom: 0,
                    marginLeft: 8,
                    paddingVertical: 6,
                    textAlign: 'center',
                    fontWeight: '800',
                  },
                ]}
                value={String(i.qty)}
                onChangeText={v => setItemQty(i.id, v)}
                onEndEditing={() => fixItemQty(i.id)}
                keyboardType="numeric"
              />
              <Text style={[ui.muted, { marginLeft: 8 }]}>
                × ₹{i.price} (max {i.stock})
              </Text>
              <Text
                style={{
                  flex: 1,
                  textAlign: 'right',
                  fontWeight: '800',
                  color: C.ink,
                }}
              >
                ₹{i.qty * i.price}
              </Text>
            </View>
          </View>
        ))}
        {cart.length > 0 && (
          <Text
            style={{
              textAlign: 'right',
              fontSize: 18,
              fontWeight: '800',
              color: C.ink,
              marginTop: 12,
            }}
          >
            Total ₹{total}
          </Text>
        )}
      </View>

      {role === 'admin' && (
        <View style={ui.card}>
          <Text style={[ui.name, { marginBottom: 10 }]}>
            4. Delivery person
          </Text>
          {staff.length === 0 ? (
            <Text style={ui.muted}>
              No delivery users yet. Add one in Admin → Users & Roles, or assign
              later.
            </Text>
          ) : (
            <Chips<string>
              value={assignTo}
              onChange={setAssignTo}
              options={[
                { key: '', label: 'Assign later' },
                ...staff.map(u => ({
                  key: u.id,
                  label: u.full_name || u.email,
                })),
              ]}
            />
          )}
        </View>
      )}

      <View style={ui.card}>
        {inp('Notes for the delivery person', 'notes', {
          placeholder: 'e.g. Call before arriving',
        })}
      </View>

      <TouchableOpacity
        style={[ui.btn, busy && { opacity: 0.6 }]}
        onPress={submit}
        disabled={busy}
      >
        <Text style={ui.btnText}>{busy ? 'Creating…' : 'Create Delivery'}</Text>
      </TouchableOpacity>
      <Text style={[ui.muted, { textAlign: 'center', marginTop: 10 }]}>
        Stock is reduced as soon as the delivery is created. A delivery barcode
        is made automatically.
      </Text>

      <Modal
        visible={scanOpen}
        animationType="slide"
        onRequestClose={() => setScanOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <BarcodeScanner active={scanOpen} onScanned={onScan} />
          <TouchableOpacity
            style={{
              position: 'absolute',
              bottom: 40,
              alignSelf: 'center',
              backgroundColor: 'rgba(0,0,0,0.7)',
              paddingHorizontal: 30,
              paddingVertical: 14,
              borderRadius: 14,
            }}
            onPress={() => setScanOpen(false)}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

const qb = {
  width: 40,
  height: 40,
  borderRadius: 10,
  backgroundColor: C.grayBg,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
const qt = { fontSize: 20, fontWeight: '800' as const, color: C.ink };
