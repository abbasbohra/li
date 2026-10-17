import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../../lib/auth';
import { C } from '../../lib/theme';
import { NO_CATEGORY } from '../../lib/config';
import { RootStackParamList } from '../../lib/types';
import BottomStack from '../BottomStack';
import Login from '../../screens/Login';
import Product from '../../screens/Product';
import Stock from '../../screens/Stock';
import StockProducts from '../../screens/StockProducts';
import Deliveries from '../../screens/Deliveries';
import NewDelivery from '../../screens/NewDelivery';
import DeliveryDetail from '../../screens/DeliveryDetail';
import Users from '../../screens/Users';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function MainStack() {
  const { session, role, loading } = useAuth();
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: C.bg,
        }}
      >
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }
  const admin = role === 'admin';
  const catalog = admin || role === 'sales' || role === 'store'; // can browse products and stock
  const deliveries = admin || role === 'sales' || role === 'delivery'; // can open deliveries\
  const inset = useSafeAreaInsets();

  return (
    <View
      style={{ flex: 1, paddingBottom: inset.bottom, backgroundColor: 'white' }}
    >
      <Stack.Navigator>
        {!session || !role ? (
          <Stack.Screen
            name="Login"
            component={Login}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Tabs"
              component={BottomStack}
              options={{ headerShown: false }}
            />
            {catalog && (
              <>
                <Stack.Screen
                  name="Product"
                  component={Product}
                  options={{ title: 'Product Details' }}
                />
                <Stack.Screen
                  name="Stock"
                  component={Stock}
                  options={{ title: 'Manage Stock' }}
                />
                <Stack.Screen
                  name="StockProducts"
                  component={StockProducts}
                  options={({ route }) => ({
                    title:
                      route.params?.model ??
                      (route.params?.category
                        ? route.params.category === NO_CATEGORY
                          ? 'Uncategorised'
                          : route.params.category
                        : 'All products'),
                  })}
                />
              </>
            )}
            {deliveries && (
              <Stack.Screen
                name="DeliveryDetail"
                component={DeliveryDetail}
                options={{ title: 'Delivery' }}
              />
            )}
            {(admin || role === 'sales') && (
              <Stack.Screen
                name="NewDelivery"
                component={NewDelivery}
                options={{ title: 'New Delivery' }}
              />
            )}
            {admin && (
              <>
                <Stack.Screen
                  name="DeliveryList"
                  component={Deliveries}
                  options={{ title: 'Deliveries' }}
                />
                <Stack.Screen
                  name="Users"
                  component={Users}
                  options={{ title: 'Users & Roles' }}
                />
              </>
            )}
          </>
        )}
      </Stack.Navigator>
    </View>
  );
}
