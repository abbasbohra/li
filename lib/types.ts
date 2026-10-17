export type Role = 'admin' | 'sales' | 'store' | 'delivery';
export type RootStackParamList = {
  Login: undefined; Tabs: undefined; Product: { id: string };
  Stock: undefined; StockProducts: { category?: string; model?: string; filter?: 'low' | 'out' } | undefined; DeliveryList: undefined; NewDelivery: undefined;
  DeliveryDetail: { id: string }; Users: undefined;
};
export type TabParamList = {
  Scan: undefined; Search: undefined; Add: { barcode?: string; category?: string; model?: string } | undefined;
  Admin: undefined; StockTab: undefined; Deliveries: undefined; Logout: undefined;
};
export type ProductRow = {
  id: string; sku: string; name: string; price: number; stock: number;
  low_stock_level?: number; category?: string | null; thumb?: string; similarity?: number;
};
export type AppUser = {
  id: string; email: string; role: Role; full_name: string | null; phone: string | null; active: boolean;
};
