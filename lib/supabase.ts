import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';
import { ProductRow } from './types';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// photo (base64) -> 512-number embedding. Shows the REAL error message from the function.
export async function embedImage(base64: string): Promise<number[]> {
  const { data, error } = await supabase.functions.invoke('embed-image', { body: { image: base64 } });
  if (error) {
    let msg = error.message;
    try {
      const b = await (error as any).context.json();
      msg = b.error || b.message || b.msg || JSON.stringify(b);
    } catch (_) {}
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data.embedding;
}

// photo -> top matching products (+ the photo's embedding, used for learning)
export async function searchByPhoto(base64: string) {
  const embedding = await embedImage(base64);
  const { data, error } = await supabase.rpc('match_products', { query_embedding: embedding, match_count: 3 });
  if (error) throw error;
  return { rows: (data ?? []) as ProductRow[], embedding };
}

// barcode -> product (exact lookup)
export async function findByBarcode(code: string) {
  const { data, error } = await supabase
    .from('products').select('id,name,sku').eq('barcode', code.trim()).maybeSingle();
  if (error) throw error;
  return data as { id: string; name: string; sku: string } | null;
}

// remember a confirmed scan photo so future scans get more accurate
export function learnScan(productId: string, embedding: number[]) {
  supabase.rpc('learn_scan', { p_id: productId, p_embedding: embedding }).then(() => {}, () => {});
}

// delivery barcode -> delivery (only deliveries the logged-in user is allowed to see come back)
export async function findDeliveryByBarcode(code: string) {
  const { data, error } = await supabase.from('deliveries').select('id,customer_name').eq('barcode', code.trim()).maybeSingle();
  if (error) throw error;
  return data as { id: string; customer_name: string } | null;
}
