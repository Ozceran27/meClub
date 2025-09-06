// src/navigation/RootNavigator.jsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import * as Linking from 'expo-linking';
import LandingScreen from '../screens/LandingScreen';
import LoginScreen from '../screens/LoginScreen';
import DashboardShell from '../screens/DashboardShell';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '../features/auth/useAuth';
import { theme } from '../theme';

const Stack = createNativeStackNavigator();

const linking = {
  prefixes: [Linking.createURL('/')],
  config: { screens: { Landing: '', Login: 'login', Dashboard: 'dashboard' } }
};

export default function RootNavigator() {
  const { ready, isLogged, isClub } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0e131f', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#2b8280" />
      </View>
    );
  }

  const initialRouteName = isLogged && isClub ? 'Dashboard' : 'Landing';

  return (
    <NavigationContainer theme={theme} linking={linking}>
      <Stack.Navigator
        key={isLogged ? 'auth' : 'guest'}
        initialRouteName={initialRouteName}
        screenOptions={{ headerShown: false, animation: 'fade' }}
      >
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Dashboard">
          {() => (
            <ProtectedRoute requiredRole="club">
              <DashboardShell />
            </ProtectedRoute>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
