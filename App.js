import { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, StatusBar, Alert } from 'react-native';
import { supabase } from './lib/supabase';
import Scan from './screens/Scan';
import Search from './screens/Search';
import Product from './screens/Product';
import Admin from './screens/Admin';
import { s } from './styles';

export default function App() {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState('scan');
  const [productId, setProductId] = useState(null);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return setIsAdmin(false);
    supabase.from('profiles').select('role').eq('id', session.user.id).single()
      .then(({ data }) => setIsAdmin(data?.role === 'admin'));
  }, [session]);

  async function login() {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) Alert.alert('Login failed', error.message);
  }

  if (!session) return (
    <SafeAreaView style={[s.screen, { justifyContent: 'center' }]}>
      <Text style={s.h1}>💡 LightShop</Text>
      <TextInput style={s.input} placeholder="Email" autoCapitalize="none" onChangeText={setEmail} />
      <TextInput style={s.input} placeholder="Password" secureTextEntry onChangeText={setPass} />
      <TouchableOpacity style={s.bigBtn} onPress={login}><Text style={s.bigBtnText}>Login</Text></TouchableOpacity>
    </SafeAreaView>
  );

  const open = (id) => setProductId(id);
  const tabs = [['scan', '📷 Scan'], ['search', '🔍 Search'], ...(isAdmin ? [['admin', '➕ Add']] : []), ['out', 'Logout']];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: StatusBar.currentHeight }}>
      <View style={{ flex: 1 }}>
        {productId ? <Product id={productId} isAdmin={isAdmin} onBack={() => setProductId(null)} />
          : tab === 'scan' ? <Scan onOpen={open} />
          : tab === 'search' ? <Search onOpen={open} />
          : <Admin />}
      </View>
      <View style={s.tabs}>
        {tabs.map(([k, label]) => (
          <TouchableOpacity key={k} style={s.tab} onPress={() => k === 'out' ? supabase.auth.signOut() : (setProductId(null), setTab(k))}>
            <Text style={{ fontWeight: tab === k ? '700' : '400' }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}
