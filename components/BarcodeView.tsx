import { PixelRatio, Text, useWindowDimensions, View } from 'react-native';

// Draws an EAN-13 barcode with plain Views (no extra library needed).
const L = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
];
const G = [
  '0100111',
  '0110011',
  '0011011',
  '0100001',
  '0011101',
  '0111001',
  '0000101',
  '0010001',
  '0001001',
  '0010111',
];
const R = [
  '1110010',
  '1100110',
  '1101100',
  '1000010',
  '1011100',
  '1001110',
  '1010000',
  '1000100',
  '1001000',
  '1110100',
];
const PARITY = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
];

export function isValidEan13(code: string) {
  if (!/^\d{13}$/.test(code)) return false;
  const d = code.split('').map(Number);
  const sum = d
    .slice(0, 12)
    .reduce((s, v, i) => s + v * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === d[12];
}

export function bitsFor(code: string) {
  const d = code.split('').map(Number);
  const p = PARITY[d[0]];
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (p[i - 1] === 'L' ? L : G)[d[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[d[i]];
  return bits + '101';
}

export default function BarcodeView({
  code,
  height = 90,
}: {
  code: string;
  height?: number;
}) {
  const { width } = useWindowDimensions();
  if (!isValidEan13(code)) {
    return (
      <Text
        style={{
          textAlign: 'center',
          fontSize: 16,
          fontWeight: '700',
          color: '#000',
        }}
      >
        {code}
      </Text>
    );
  }
  // module width snapped to whole screen pixels so bars stay crisp and scannable
  const m = PixelRatio.roundToNearestPixel(
    Math.max(1, Math.min(3, (width - 64) / 113)),
  );
  const runs: { dark: boolean; n: number }[] = [];
  for (const b of bitsFor(code)) {
    const dark = b === '1';
    const last = runs[runs.length - 1];
    if (last && last.dark === dark) last.n++;
    else runs.push({ dark, n: 1 });
  }
  return (
    <View
      style={{
        alignSelf: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 9 * m,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
      }}
    >
      <View style={{ flexDirection: 'row', height }}>
        {runs.map((r, i) => (
          <View
            key={i}
            style={{
              width: r.n * m,
              height,
              backgroundColor: r.dark ? '#000' : '#fff',
            }}
          />
        ))}
      </View>
      <Text
        style={{
          marginTop: 6,
          fontSize: 14,
          letterSpacing: 3,
          color: '#000',
          fontWeight: '600',
        }}
      >
        {code}
      </Text>
    </View>
  );
}
