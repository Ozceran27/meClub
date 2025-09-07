import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../features/auth/useAuth';

export default function WorkInProgressScreen() {
  const nav = useNavigation();
  const { logout } = useAuth();

  return (
    <View className="flex-1 bg-mc-bg items-center justify-center gap-4">
      <Ionicons
        name="construct-outline"
        size={64}
        color="#FBBF24"
        className="mb-2"
      />
      <Text className="text-mc-text text-xl text-center">
        Estamos trabajando en esta página
      </Text>
      <Pressable
        onPress={() => nav.navigate('Landing')}
        className="bg-mc-primary px-4 py-2 rounded-lg"
      >
        <Text className="text-white text-base">Ir al inicio</Text>
      </Pressable>
      <Pressable
        onPress={logout}
        className="bg-mc-warn px-4 py-2 rounded-lg"
      >
        <Text className="text-white text-base">Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}
