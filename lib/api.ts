// One place for every call that changes data. The app only asks; the database decides (role checks run server-side).
import { supabase } from './supabase';
import { AppUser, Role } from './types';

async function rpc<T = any>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

async function callFn<T = any>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    try {
      const b = await (error as any).context.json();
      msg = b.error || b.message || b.msg || JSON.stringify(b);
    } catch (_) {}
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

type NewUser = { email: string; password: string; role: Role; full_name?: string; phone?: string };
type UserPatch = { id: string; role?: Role; full_name?: string; phone?: string; active?: boolean; password?: string };

export const api = {
  summary: () => rpc('admin_summary'),
  adjustStock: (id: string, qty: number, reason: 'sale' | 'purchase' | 'adjustment' | 'return', note?: string) =>
    rpc<number>('adjust_stock', { p_id: id, qty, p_reason: reason, p_note: note ?? null }),
  setStock: (id: string, count: number, note?: string) =>
    rpc<number>('set_stock', { p_id: id, p_count: count, p_note: note ?? null }),
  createDelivery: (
    d: { name: string; phone: string; address: string; notes: string; landmark?: string; city?: string; pincode?: string; lat?: number; lng?: number; assignTo?: string },
    items: { product_id: string; qty: number }[],
  ) => rpc<string>('create_delivery', {
    p_name: d.name, p_phone: d.phone, p_address: d.address, p_notes: d.notes, p_items: items,
    p_landmark: d.landmark ?? null, p_city: d.city ?? null, p_pincode: d.pincode ?? null,
    p_lat: d.lat ?? null, p_lng: d.lng ?? null, p_assign_to: d.assignTo ?? null,
  }),
  assignDelivery: (id: string, userId: string) => rpc('assign_delivery', { p_id: id, p_user: userId }),
  setDeliveryStatus: (id: string, status: 'out_for_delivery' | 'delivered', proofPath?: string, note?: string, lat?: number, lng?: number) =>
    rpc('update_delivery_status', { p_id: id, p_status: status, p_proof: proofPath ?? null, p_note: note ?? null, p_lat: lat ?? null, p_lng: lng ?? null }),
  cancelDelivery: (id: string) => rpc('cancel_delivery', { p_id: id }),
  setDeliveryLocation: (id: string, lat: number, lng: number) => rpc('set_delivery_location', { p_id: id, p_lat: lat, p_lng: lng }),
  generateBarcode: (id: string) => rpc<string>('generate_barcode', { p_id: id }),
  users: {
    list: () => callFn<{ users: AppUser[] }>('admin-users', { action: 'list' }).then((r) => r.users),
    create: (u: NewUser) => callFn('admin-users', { action: 'create', ...u }),
    update: (u: UserPatch) => callFn('admin-users', { action: 'update', ...u }),
  },
};
