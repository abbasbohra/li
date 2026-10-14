import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }
);

// photo (base64) -> top matching products
export async function searchByPhoto(base64) {
  const { data, error } = await supabase.functions.invoke('embed-image', { body: { image: base64 } });
  if (error || data?.error) throw new Error(error?.message || data.error);
  const { data: rows, error: e2 } = await supabase.rpc('match_products', {
    query_embedding: data.embedding, match_count: 3,
  });
  if (e2) throw e2;
  return rows;
}
