import { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { C } from '../lib/theme';
import { ui } from '../lib/ui';
import Chips from './Chips';
import Sheet from './Sheet';

type Mode = 'add' | 'set';
type Props = {
  product: { id: string; name: string; stock: number } | null; // null = closed
  onClose: () => void;
  onSaved: () => void;
};

// Admin-only window: add received stock, or set the exact counted stock.
export default function StockSheet({ product, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<Mode>('add');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [hist, setHist] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!product) return;
    setMode('add'); setQty(''); setNote(''); setHist([]);
    supabase.from('stock_movements').select('change,reason,note,created_at')
      .eq('product_id', product.id).order('created_at', { ascending: false }).limit(8)
      .then(({ data }) => setHist(data ?? []));
  }, [product?.id]);

  async function save() {
    if (!product) return;
    const n = parseInt(qty, 10);
    if (isNaN(n) || n < 0 || (mode === 'add' && n === 0)) return Alert.alert('Enter a valid number');
    setBusy(true);
    try {
      if (mode === 'add') await api.adjustStock(product.id, n, 'purchase', note.trim() || undefined);
      else await api.setStock(product.id, n, note.trim() || undefined);
      onSaved();
      onClose();
    } catch (e: any) { Alert.alert('Could not update stock', e.message); }
    setBusy(false);
  }

  return (
    <Sheet visible={!!product} onClose={onClose} title={product?.name ?? ''}>
      <Text style={[ui.muted, { marginBottom: 10 }]}>Current stock: {product?.stock}</Text>
      <Chips<Mode> value={mode} onChange={setMode}
        options={[{ key: 'add', label: '+ Add stock' }, { key: 'set', label: 'Set exact count' }]} />
      <Text style={ui.label}>{mode === 'add' ? 'Quantity received' : 'Counted stock'}</Text>
      <TextInput style={ui.input} value={qty} onChangeText={setQty} keyboardType="numeric" placeholder="0" placeholderTextColor={C.sub} />
      <Text style={ui.label}>Note (optional)</Text>
      <TextInput style={ui.input} value={note} onChangeText={setNote} placeholder="e.g. Supplier invoice 123" placeholderTextColor={C.sub} />
      <TouchableOpacity style={[ui.btn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
        <Text style={ui.btnText}>{busy ? 'Saving…' : 'Save'}</Text>
      </TouchableOpacity>
      {hist.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <Text style={[ui.label, { marginBottom: 8 }]}>Recent changes</Text>
          {hist.map((h, i) => (
            <View key={i} style={[ui.row, { justifyContent: 'space-between', paddingVertical: 6 }]}>
              <Text style={{ color: C.ink, flex: 1 }} numberOfLines={1}>{h.reason}{h.note ? ` · ${h.note}` : ''}</Text>
              <Text style={{ fontWeight: '800', color: h.change < 0 ? C.red : C.green }}>{h.change > 0 ? '+' : ''}{h.change}</Text>
            </View>
          ))}
        </View>
      )}
    </Sheet>
  );
}
