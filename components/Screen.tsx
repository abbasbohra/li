import { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../lib/theme';

export default function Screen({ children }: { children: ReactNode }) {
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>{children}</SafeAreaView>;
}
