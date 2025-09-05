import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../features/auth/useAuth';

function hasRole(user, role) {
  if (!role) return true;
  const value = String(user?.rol ?? user?.role ?? '').toLowerCase();
  return value === String(role).toLowerCase();
}

export default function ProtectedRoute({ children, requiredRole }) {
  const { ready, isLogged, user } = useAuth();
  const nav = useNavigation();

  useEffect(() => {
    if (!ready || typeof isLogged === 'undefined') return;
    if (!isLogged) {
      nav.reset({ index: 0, routes: [{ name: 'Login' }] });
    } else if (requiredRole && !hasRole(user, requiredRole)) {
      nav.reset({ index: 0, routes: [{ name: 'Landing' }] });
    }
  }, [ready, isLogged, user, requiredRole, nav]);

  if (!ready || typeof isLogged === 'undefined' || !isLogged || (requiredRole && !hasRole(user, requiredRole))) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0e131f', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#2b8280" />
      </View>
    );
  }

  return children;
}
