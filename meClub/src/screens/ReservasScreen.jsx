import React from 'react';
import { View, Text } from 'react-native';
import DashboardShell from './DashboardShell';

export default function ReservasScreen() {
  return (
    <DashboardShell>
      <View className="px-6 pb-10">
        <Text className="text-white/80 text-lg">Reservas</Text>
        <View className="mt-4 rounded-2xl p-5 bg-[#0F172A]/90 ring-1 ring-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <Text className="text-white/70">Aquí mostraremos reservas de hoy/semana (hidratación más adelante).</Text>
        </View>
      </View>
    </DashboardShell>
  );
}
