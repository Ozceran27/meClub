import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../features/auth/useAuth';

export default function ServiciosScreen() {
  const nav = useNavigation();
  const { logout } = useAuth();

  return (
    <View className="flex-1 bg-mc-bg items-center justify-center gap-4">
      <Ionicons
        name="pricetags-outline"
        size={64}
        color="#FBBF24"
        className="mb-2"
      />
      <Text className="text-mc-text text-xl text-center">
        Estamos preparando la sección de Servicios
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
