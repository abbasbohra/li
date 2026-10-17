import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { C, shadow } from '../lib/theme';
import { ProductRow } from '../lib/types';

export function stockInfo(stock: number, low = 5) {
  if (stock <= 0) return { label: 'Out of stock', fg: C.red, bg: C.redBg };
  if (stock <= low)
    return { label: `Low stock · ${stock}`, fg: C.amber, bg: C.amberBg };
  return { label: `In stock · ${stock}`, fg: C.green, bg: C.greenBg };
}

export function matchInfo(sim: number) {
  const pct = Math.round(sim * 100);
  if (sim >= 0.8)
    return { label: `${pct}% Strong match`, fg: C.green, bg: C.greenBg };
  if (sim >= 0.6)
    return { label: `${pct}% Possible match`, fg: C.amber, bg: C.amberBg };
  return { label: `${pct}% Weak match`, fg: C.gray, bg: C.grayBg };
}

export function Pill({
  label,
  fg,
  bg,
}: {
  label: string;
  fg: string;
  bg: string;
}) {
  return (
    <View style={[st.pill, { backgroundColor: bg }]}>
      <Text style={[st.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

type Props = {
  item: ProductRow;
  onPress: () => void;
  match?: number;
  badge?: 'exact' | 'best';
};

export default function ProductCard({ item, onPress, match, badge }: Props) {
  const stock = stockInfo(item.stock, item.low_stock_level);
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[
        st.card,
        badge === 'best' && st.best,
        badge === 'exact' && st.exact,
      ]}
      onPress={onPress}
    >
      {badge && (
        <Text style={[st.tag, badge === 'exact' && { color: C.green }]}>
          {badge === 'exact' ? '✓ EXACT MATCH' : '★ BEST GUESS'}
        </Text>
      )}
      <View style={st.row}>
        {item.thumb ? (
          <Image source={{ uri: item.thumb }} style={st.thumb} />
        ) : (
          <View style={[st.thumb, st.noThumb]}>
            <Text style={{ fontSize: 28 }}>💡</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={st.name} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={st.sku}>
            {item.sku}
            {item.category ? `  ·  ${item.category}` : ''}
          </Text>
          <Text style={st.price}>₹{item.price}</Text>
        </View>
        <Text style={st.chev}>›</Text>
      </View>
      <View style={st.pills}>
        <Pill {...stock} />
        {match != null && <Pill {...matchInfo(match)} />}
      </View>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.line,
    ...shadow,
  },
  best: { borderColor: C.accent, borderWidth: 2 },
  exact: { borderColor: C.green, borderWidth: 2 },
  tag: {
    fontSize: 11,
    fontWeight: '800',
    color: C.amber,
    letterSpacing: 1,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: C.bg,
  },
  noThumb: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: C.ink },
  sku: { fontSize: 12, color: C.sub, marginTop: 2 },
  price: { fontSize: 18, fontWeight: '800', color: C.ink, marginTop: 4 },
  chev: { fontSize: 28, color: C.sub, marginLeft: 6 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 4,
  },
  pillText: { fontSize: 12, fontWeight: '700' },
});
