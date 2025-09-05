import React from 'react';
import { View, Text } from 'react-native';

export default function CanchasScreen() {
  return (
    <View className="flex-1">
      <View className="py-6">
        <Text className="text-white text-[36px] font-extrabold tracking-tight">Mis Canchas</Text>
        <Text className="text-white/60 mt-1">Próximamente</Text>
      </View>
    </View>
  );
}
