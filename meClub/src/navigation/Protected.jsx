import { View, ActivityIndicator } from 'react-native';
import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../features/auth/useAuth';

export default function Protected({ children }) {
  const { ready, isLogged } = useAuth();
  const nav = useNavigation();

  useEffect(() => {
    if (ready && !isLogged) {
      nav.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  }, [ready, isLogged, nav]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0e131f', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#2b8280" />
      </View>
    );
  }

  if (!isLogged) return null;

  return children;
}
