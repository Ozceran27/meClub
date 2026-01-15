import React from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import Card from '../../components/Card';
import ScreenHeader from '../../components/ScreenHeader';

export default function MejorarPlanScreen({ go }) {
  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="flex-row items-center justify-between px-4 md:px-0">
        <ScreenHeader
          title="Mejorar plan"
          subtitle="Muy pronto vas a poder ampliar el nivel de tu club"
        />
        <Pressable
          onPress={() => go?.('configuracion')}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10"
        >
          <Text className="text-white/80 text-sm font-medium">Volver</Text>
        </Pressable>
      </View>

      <Card className="mt-8 mx-4 md:mx-0 p-6">
        <Text className="text-white/80 text-base">
          Estamos preparando la pantalla de mejora de plan. Próximamente vas a ver acá los detalles,
          beneficios y opciones de pago.
        </Text>
      </Card>
    </ScrollView>
  );
}
