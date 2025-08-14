import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

export default function LandingScreen() {
  const nav = useNavigation();
  return (
    <View className="flex-1 bg-mc-bg">
      <LinearGradient colors={['#0e131f', '#0b0f1a']} className="absolute inset-0" />
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-mc-text text-4xl font-bold mb-3">meClub</Text>
        <Text className="text-mc-textDim text-center mb-8">
          Reservas deportivas + comunidad. Empezá ahora.
        </Text>
        <Pressable
          onPress={() => nav.navigate('Login')}
          className="bg-mc-primary px-6 py-3 rounded-xl2 shadow-soft"
        >
          <Text className="text-white font-semibold text-base">Iniciar sesión</Text>
        </Pressable>
      </View>
    </View>
  );
}
