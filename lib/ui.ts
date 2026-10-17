import { StyleSheet } from 'react-native';
import { C, shadow } from './theme';

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pad: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 28, fontWeight: '800', color: C.ink },
  sub: { fontSize: 14, color: C.sub, marginTop: 2, marginBottom: 14 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 12, ...shadow },
  label: { fontSize: 12, fontWeight: '700', color: C.sub, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.ink, backgroundColor: C.bg, marginBottom: 12 },
  btn: { backgroundColor: C.ink, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: C.ink },
  muted: { fontSize: 12, color: C.sub, marginTop: 2 },
  empty: { textAlign: 'center', color: C.sub, marginTop: 40 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, marginRight: 8, marginBottom: 8 },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontSize: 13, color: C.ink, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, maxHeight: '88%' },
});

export function statusInfo(s: string) {
  switch (s) {
    case 'pending': return { label: 'Pending', fg: C.amber, bg: C.amberBg };
    case 'assigned': return { label: 'Assigned', fg: '#1D4ED8', bg: '#DBEAFE' };
    case 'out_for_delivery': return { label: 'Out for delivery', fg: '#6D28D9', bg: '#EDE9FE' };
    case 'delivered': return { label: 'Delivered', fg: C.green, bg: C.greenBg };
    default: return { label: 'Cancelled', fg: C.red, bg: C.redBg };
  }
}

export function roleInfo(r: string) {
  if (r === 'admin') return { label: 'Admin', fg: C.ink, bg: C.accentSoft };
  if (r === 'delivery') return { label: 'Delivery', fg: '#6D28D9', bg: '#EDE9FE' };
  if (r === 'store') return { label: 'Store', fg: C.green, bg: C.greenBg };
  return { label: 'Sales', fg: '#1D4ED8', bg: '#DBEAFE' };
}
