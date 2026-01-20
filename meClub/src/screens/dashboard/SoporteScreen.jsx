import React from 'react';
import { View, Text, Pressable } from 'react-native';
import ScreenHeader from '../../components/ScreenHeader';

export default function SoporteScreen({ go }) {
  return (
    <View className="flex-1 px-4 md:px-0">
      <View className="flex-row items-center justify-between">
        <ScreenHeader
          title="Soporte"
          subtitle="Estamos listos para ayudarte con tu club"
        />
        <Pressable
          onPress={() => go?.('inicio')}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10"
        >
          <Text className="text-white/80 text-sm font-medium">Volver</Text>
        </Pressable>
      </View>

      <View className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <Text className="text-white text-base font-semibold">¿Cómo podemos ayudarte?</Text>
        <Text className="text-white/70 text-sm mt-2">
          Escribinos a soporte@meclub.app o dejá tu consulta desde el centro de ayuda. En breve
          nuestro equipo te contactará.
        </Text>
        <View className="mt-4 gap-2">
          <Text className="text-white/80 text-sm">• Horario de atención: lunes a viernes, 9 a 18 hs.</Text>
          <Text className="text-white/80 text-sm">• Tiempo estimado de respuesta: 24 a 48 hs.</Text>
        </View>
      </View>
    </View>
  );
}
