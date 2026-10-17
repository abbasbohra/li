import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Role } from './types';

type Auth = { session: Session | null; role: Role | null; name: string | null; isAdmin: boolean; loading: boolean };
const Ctx = createContext<Auth>({ session: null, role: null, name: null, isAdmin: false, loading: true });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ role: Role; full_name: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const uid = session?.user.id;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) { setProfile(null); setLoading(false); }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // load role once per login (not on every token refresh)
  useEffect(() => {
    if (!uid) return;
    let off = false;
    setLoading(true);
    supabase.from('profiles').select('role,full_name,active').eq('id', uid).single().then(({ data, error }) => {
      if (off) return;
      if (error || !data || data.active === false) {
        Alert.alert('Account not available', 'This account is disabled or has no role. Please contact the admin.');
        supabase.auth.signOut();
      } else {
        setProfile({ role: data.role as Role, full_name: data.full_name });
      }
      setLoading(false);
    });
    return () => { off = true; };
  }, [uid]);

  const role = profile?.role ?? null;
  return (
    <Ctx.Provider value={{ session, role, name: profile?.full_name ?? null, isAdmin: role === 'admin', loading }}>
      {children}
    </Ctx.Provider>
  );
}
