import { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { C } from '../lib/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);

  async function login() {
    setBusy(true);
    const { error, data } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });
    console.log(data);
    setBusy(false);
    if (error) Alert.alert('Login failed', error.message);
  }

  return (
    <SafeAreaView style={st.root}>
      <Text style={st.logo}>💡</Text>
      <Text style={st.brand}>LightShop</Text>
      <Text style={st.tag}>Find any product with a photo or barcode</Text>
      <TextInput
        style={st.input}
        placeholder="Email"
        placeholderTextColor={C.sub}
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
      />
      <TextInput
        style={st.input}
        placeholder="Password"
        placeholderTextColor={C.sub}
        secureTextEntry
        onChangeText={setPass}
      />
      <TouchableOpacity
        style={[st.btn, busy && { opacity: 0.6 }]}
        onPress={login}
        disabled={busy}
      >
        <Text style={st.btnText}>{busy ? 'Logging in…' : 'Login'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    padding: 24,
  },
  logo: { fontSize: 56, textAlign: 'center' },
  brand: { fontSize: 32, fontWeight: '800', color: C.ink, textAlign: 'center' },
  tag: { color: C.sub, textAlign: 'center', marginBottom: 28, marginTop: 4 },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: C.ink,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: C.accent,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { fontSize: 16, fontWeight: '800', color: C.ink },
});
