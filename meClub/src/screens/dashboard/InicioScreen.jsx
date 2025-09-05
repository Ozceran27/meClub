import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PANEL_BG = 'bg-[#0F172A]/90';
const cardCls = `${PANEL_BG} rounded-2xl p-5 shadow-[0_2px_8px_rgba(148,163,184,0.12),0_2px_8px_rgba(255,255,255,0.06)]`;

export default function InicioScreen({ summary = {}, firstName, today }) {
  return (
    <>
      <View className="py-6">
        <Text className="text-white text-[36px] font-extrabold tracking-tight">Hola, {firstName}</Text>
        <Text className="text-white/60 mt-1">{today}</Text>
      </View>

      <View className="gap-6">
        {/* fila 1 */}
        <View className="flex-row gap-6">
          <View className={`flex-1 ${cardCls}`}>
            <Text className="text-teal-300 font-semibold tracking-widest text-[13px]">MIS CANCHAS</Text>
            <Text className="text-white text-[32px] mt-2 font-bold">
              {summary.courtsAvailable ?? 0} disponibles
            </Text>
            <Pressable className="self-start mt-4 rounded-xl px-4 py-2 border border-teal-300/30 bg-teal-400/20 hover:bg-teal-400/30">
              <Text className="text-teal-200 font-medium">VER CANCHAS</Text>
            </Pressable>
          </View>

          <View className={`flex-1 ${cardCls}`}>
            <Text className="text-amber-300 font-semibold tracking-widest text-[13px]">PRÓXIMO EVENTO</Text>
            <Text className="text-white text-[28px] mt-2 font-semibold">Torneo de Primavera</Text>
            <Text className="text-white/60 mt-2">martes, 30 de abril de 2024</Text>
          </View>
        </View>

        {/* fila 2 */}
        <View className="flex-row gap-6">
          <View className={`flex-1 ${cardCls}`}>
            <Text className="text-sky-300 font-semibold tracking-widest text-[13px]">RESERVAS</Text>
            <Text className="text-white text-[32px] mt-2 font-bold">
              {summary.reservasHoy ?? 0} hoy
            </Text>
            <Text className="text-white/60 mt-1">+{summary.reservasSemana ?? 0} esta semana</Text>
            <Pressable className="self-start mt-4 rounded-xl px-4 py-2 border border-sky-300/30 bg-sky-400/15 hover:bg-sky-400/25">
              <Text className="text-sky-200 font-medium">VER RESERVAS</Text>
            </Pressable>
          </View>

          <View className={`flex-1 ${cardCls}`}>
            <Text className="text-emerald-300 font-semibold tracking-widest text-[13px]">ECONOMÍA</Text>
            <Text className="text-white text-[32px] mt-2 font-bold">
              {`$${Number(summary.economiaMes ?? 0).toLocaleString('es-AR')} este mes`}
            </Text>
            <View className="mt-4 h-24 rounded-xl bg-white/5" />
          </View>
        </View>

        {/* fila 3 */}
        <View className="flex-row gap-6">
          <View className={`flex-1 ${cardCls}`}>
            <Text className="text-teal-300 font-semibold tracking-widest text-[13px]">EVENTOS</Text>
            <View className="mt-3 flex-row items-center justify-between">
              <Text className="text-white text-[24px] font-semibold">meEquipo</Text>
              <Ionicons name="chevron-forward" size={20} color="#9FB3C8" />
            </View>
          </View>

          <View className={`flex-1 ${cardCls}`}>
            <Text className="text-teal-300 font-semibold tracking-widest text-[13px]">EVENTOS</Text>
            <View className="mt-3 flex-row items-center justify-between">
              <Text className="text-white text-[24px] font-semibold">Ranking</Text>
              <Ionicons name="chevron-forward" size={20} color="#9FB3C8" />
            </View>
          </View>
        </View>
      </View>
    </>
  );
}
