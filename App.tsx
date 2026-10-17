import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './lib/auth';
import { C } from './lib/theme';
import MainStack from './src/MainStack';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: C.bg,
    primary: C.accent,
    card: C.card,
    text: C.ink,
    border: C.line,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer theme={navTheme}>
          <MainStack />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
