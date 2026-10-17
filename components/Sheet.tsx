import { ReactNode } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { C } from '../lib/theme';
import { ui } from '../lib/ui';

type Props = { visible: boolean; onClose: () => void; title: string; children: ReactNode };

export default function Sheet({ visible, onClose, title, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity activeOpacity={1} style={ui.modalBg} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={ui.sheet}>
            <View style={[ui.row, { justifyContent: 'space-between', marginBottom: 12 }]}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>{title}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10}><Text style={{ fontSize: 18, color: C.sub }}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}
