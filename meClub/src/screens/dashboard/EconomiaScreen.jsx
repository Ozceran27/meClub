import React from 'react';
import { View, Text } from 'react-native';

export default function EconomiaScreen({ summary = {} }) {
  const formattedAmount = React.useMemo(
    () => `$${Number(summary.economiaMes ?? 0).toLocaleString('es-AR')}`,
    [summary.economiaMes],
  );

  return (
    <View className="flex-1">
      <View className="py-6">
        <Text className="text-white text-[36px] font-extrabold tracking-tight">Economía</Text>
        <Text className="text-white/60 mt-1">Resumen económico del club</Text>
      </View>
      <View className="gap-6">
        <View className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <Text className="text-white/70 text-[14px] uppercase tracking-[0.2em]">
            Ingresos del mes
          </Text>
          <Text className="text-white text-[40px] font-extrabold mt-3">{formattedAmount}</Text>
          <Text className="text-white/50 mt-2">
            Mantén al día tus registros económicos y controla la salud financiera del club.
          </Text>
        </View>
      </View>
    </View>
  );
}
