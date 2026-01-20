// src/navigation/RootNavigator.jsx
import { NavigationContainer, getPathFromState as getPathFromStateBase, getStateFromPath as getStateFromPathBase } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useCallback, useEffect } from 'react';
import * as Linking from 'expo-linking';
import LandingScreen from '../screens/LandingScreen';
import LoginScreen from '../screens/LoginScreen';
import DashboardShell from '../screens/DashboardShell';
import WorkInProgressScreen from '../screens/WorkInProgressScreen';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '../features/auth/useAuth';
import { theme } from '../theme';
import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator();
const webScreenParam = 'screen';

const toWebQueryPath = (path) => {
  const normalized = String(path ?? '').replace(/^\/+/, '');
  if (!normalized) return '/';
  return `/?${webScreenParam}=${encodeURIComponent(normalized)}`;
};

const normalizeWebLocation = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const { pathname = '/', search = '' } = window.location;
  const params = new URLSearchParams(search);
  if (params.get(webScreenParam)) return;
  const normalizedPath = String(pathname ?? '').replace(/^\/+/, '');
  if (!normalizedPath) return;
  params.set(webScreenParam, normalizedPath);
  const nextSearch = params.toString();
  const nextUrl = nextSearch ? `/?${nextSearch}` : '/';
  window.history.replaceState(window.history.state, '', nextUrl);
};

const getStateFromPath = (path, config) => {
  if (Platform.OS === 'web') {
    const [, search = ''] = String(path ?? '').split('?');
    const params = new URLSearchParams(search);
    const screen = params.get(webScreenParam);
    if (screen) {
      const normalized = decodeURIComponent(screen).replace(/^\/+/, '');
      return getStateFromPathBase(normalized, config);
    }
  }

  return getStateFromPathBase(path, config);
};

const getPathFromState = (state, config) => {
  const path = getPathFromStateBase(state, config);
  if (Platform.OS === 'web') {
    return toWebQueryPath(path);
  }
  return path;
};

const linking = {
  prefixes: [Linking.createURL('/')],
  config: {
    screens: {
      Landing: '',
      Login: 'login',
      WorkInProgress: 'working',
      Dashboard: 'dashboard',
    },
  },
  getStateFromPath,
  getPathFromState,
};

export default function RootNavigator() {
  const { ready, isLogged, isClub } = useAuth();
  const syncWebLocation = useCallback(() => {
    normalizeWebLocation();
  }, []);

  useEffect(() => {
    syncWebLocation();
  }, [syncWebLocation]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0e131f', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#2b8280" />
      </View>
    );
  }

  const initialRouteName = isLogged ? (isClub ? 'Dashboard' : 'WorkInProgress') : 'Landing';

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={theme}
      linking={linking}
      onReady={syncWebLocation}
      onStateChange={syncWebLocation}
    >
      <Stack.Navigator
        key={isLogged ? 'auth' : 'guest'}
        initialRouteName={initialRouteName}
        screenOptions={{ headerShown: false, animation: 'fade' }}
      >
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="WorkInProgress">
          {() => (
            <ProtectedRoute>
              <WorkInProgressScreen />
            </ProtectedRoute>
          )}
        </Stack.Screen>
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
