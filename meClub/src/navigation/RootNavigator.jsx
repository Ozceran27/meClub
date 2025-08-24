// src/navigation/RootNavigator.jsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, Text, Pressable } from 'react-native';
import LandingScreen   from '../screens/LandingScreen';
import LoginScreen     from '../screens/LoginScreen';
import DashboardShell  from '../screens/DashboardShell';
import { useAuth }     from '../features/auth/useAuth';

const Stack = createNativeStackNavigator();

function isClubUser(user) {
  const value = String(user?.rol ?? user?.role ?? '').toLowerCase();
  return value === 'club' || value === 'clubes';
}

export default function RootNavigator() {
  const { user, ready, logout } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0e131f', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#2b8280" />
      </View>
    );
  }

  const allowClub = user && isClubUser(user);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {!allowClub ? (
          <>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Login"   component={LoginScreen} />
            {user ? (
              <Stack.Screen name="NoAutorizado">
                {() => (
                  <View style={{ flex: 1, backgroundColor: '#0e131f', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
                    <Text style={{ color:'#dbe7ff', fontSize:18, fontWeight:'800' }}>Tu cuenta no es de Club</Text>
                    <Text style={{ color:'#8ca0b3', textAlign:'center' }}>
                      Este panel es exclusivo para clubes. Cerrá sesión para acceder con otra cuenta
                      o volvé a la página principal.
                    </Text>
                    <Pressable onPress={logout} style={{ paddingVertical:10, paddingHorizontal:16, borderRadius:10, borderWidth:1, borderColor:'#24334d' }}>
                      <Text style={{ color:'#e87979', fontWeight:'700' }}>Cerrar sesión</Text>
                    </Pressable>
                  </View>
                )}
              </Stack.Screen>
            ) : null}
          </>
        ) : (
          // Solo clubes
          <Stack.Screen name="Dashboard" component={DashboardShell} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
