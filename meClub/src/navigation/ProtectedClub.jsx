import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../features/auth/useAuth';

function isClubUser(u) {
  const v = String(u?.rol ?? u?.role ?? '').toLowerCase();
  return v === 'club' || v === 'clubes';
}

export default function ProtectedClub({ children }) {
  const { user, ready } = useAuth();
  const nav = useNavigation();

  useEffect(() => {
    if (!ready) return;
    if (!user || !isClubUser(user)) {
       nav.reset({ index: 0, routes: [{ name: 'Landing' }] });
    }
  }, [ready, user, nav]);

  if (!ready || !user) {
    return (
      <View style={{ flex:1, backgroundColor:'#0e131f', alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator color="#2b8280" />
      </View>
    );
  }

  if (!isClubUser(user)) return null;

  return children;
}
