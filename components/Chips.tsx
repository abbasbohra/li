import { View, Text, TouchableOpacity } from 'react-native';
import { ui } from '../lib/ui';

type Props<T extends string> = { options: { key: T; label: string }[]; value: T; onChange: (k: T) => void };

export default function Chips<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={ui.chips}>
      {options.map((o) => (
        <TouchableOpacity key={o.key} style={[ui.chip, value === o.key && ui.chipOn]} onPress={() => onChange(o.key)}>
          <Text style={[ui.chipText, value === o.key && ui.chipTextOn]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
