import { Alert, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { C, shadow } from '../../lib/theme';
import { TabParamList } from '../../lib/types';
import Scan from '../../screens/Scan';
import Search from '../../screens/Search';
import Stock from '../../screens/Stock';
import AddProduct from '../../screens/AddProduct';
import Admin from '../../screens/Admin';
import Deliveries from '../../screens/Deliveries';

const Tab = createBottomTabNavigator<TabParamList>();
const Empty = () => null;
const icon = (emoji: string) => ({ focused }: { focused: boolean }) => (
  <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
);

// What each role sees:
//  admin    = Scan, Search, Add Product, Admin panel (stock, deliveries, users)
//  store    = Scan, Search, Stock (add / update stock, barcodes), Add Product
//  sales    = Scan, Search, Stock (view), Deliveries (create and track)
//  delivery = Deliveries only (assigned list, mark delivered with photo)
export default function BottomStack() {
  const { role } = useAuth();
  const is = (...r: string[]) => !!role && r.includes(role);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.ink,
        tabBarInactiveTintColor: C.sub,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: { height: 62, paddingBottom: 8, paddingTop: 6, backgroundColor: C.card, ...shadow },
      }}
    >
      {is('admin', 'sales', 'store') && <Tab.Screen name="Scan" component={Scan} options={{ tabBarIcon: icon('📷') }} />}
      {is('admin', 'sales', 'store') && <Tab.Screen name="Search" component={Search} options={{ tabBarIcon: icon('🔍') }} />}
      {is('sales', 'store') && <Tab.Screen name="StockTab" component={Stock} options={{ tabBarLabel: 'Stock', tabBarIcon: icon('📦') }} />}
      {is('admin', 'store') && <Tab.Screen name="Add" component={AddProduct} options={{ tabBarLabel: 'Add Product', tabBarIcon: icon('➕') }} />}
      {is('admin') && <Tab.Screen name="Admin" component={Admin} options={{ tabBarIcon: icon('🛠️') }} />}
      {is('sales', 'delivery') && <Tab.Screen name="Deliveries" component={Deliveries} options={{ tabBarIcon: icon('🚚') }} />}
      <Tab.Screen
        name="Logout"
        component={Empty}
        options={{ tabBarIcon: icon('🚪') }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            Alert.alert('Logout', 'Do you want to log out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Logout', style: 'destructive', onPress: () => supabase.auth.signOut() },
            ]);
          },
        }}
      />
    </Tab.Navigator>
  );
}
