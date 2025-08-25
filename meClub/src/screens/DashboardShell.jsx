// src/features/dashboard/DashboardShell.jsx
import React from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

const NAV_BG = 'bg-[#0F172A]/80'; // mismo tono para sidebar y topbar (slate-900 con opacidad)
const PANEL_BG = 'bg-[#0B1222]/60'; // tarjetas oscuras semi

const SidebarItem = ({ icon, label, active, onPress }) => (
  <Pressable
    onPress={onPress}
    className={`w-full rounded-xl px-3 py-3 mb-1.5
                ${active ? 'bg-white/5' : 'bg-transparent'}
               `}
    style={{}}
  >
    <View className="flex-row items-center justify-start gap-3">
      {icon}
      <Text
        className={`text-[15px] leading-5 ${
          active ? 'text-white' : 'text-white/80'
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  </Pressable>
);

export default function DashboardShell({ children, user }) {
  const navigation = useNavigation();
  const route = useRoute();
  const current = route?.name || 'inicio';

  // Lista de items (solo Club). Si luego cambian rutas, edita "key" y navegación.
  const items = [
    { key: 'inicio', label: 'Inicio', icon: <Ionicons name="home-outline" size={18} color="#9FB3C8" /> },
    { key: 'buzon', label: 'Buzón', icon: <Ionicons name="mail-outline" size={18} color="#9FB3C8" /> },
    { key: 'mis-canchas', label: 'Mis Canchas', icon: <MaterialCommunityIcons name="tennis" size={18} color="#9FB3C8" /> },
    { key: 'reservas', label: 'Reservas', icon: <Ionicons name="calendar-outline" size={18} color="#9FB3C8" /> },
    { key: 'horarios', label: 'Horarios', icon: <Ionicons name="time-outline" size={18} color="#9FB3C8" /> },
    { key: 'tarifas', label: 'Tarifas', icon: <Ionicons name="pricetags-outline" size={18} color="#9FB3C8" /> },
    { key: 'grabaciones', label: 'Grabaciones', icon: <Feather name="video" size={18} color="#9FB3C8" /> },
    { key: 'eventos', label: 'Eventos', icon: <Ionicons name="sparkles-outline" size={18} color="#9FB3C8" /> },
    { key: 'me-equipo', label: 'meEquipo', icon: <Ionicons name="people-outline" size={18} color="#9FB3C8" /> },
    { key: 'ranking', label: 'Ranking', icon: <Ionicons name="trophy-outline" size={18} color="#9FB3C8" /> },
    { key: 'conciliar', label: 'Conciliar', icon: <Ionicons name="repeat-outline" size={18} color="#9FB3C8" /> },
    { key: 'ajustes', label: 'Ajustes', icon: <Ionicons name="settings-outline" size={18} color="#9FB3C8" /> },
    { key: 'soporte', label: 'Soporte', icon: <Ionicons name="help-circle-outline" size={18} color="#9FB3C8" /> },
  ];

  const go = (key) => {
    // ajusta a tus rutas reales
    if (key === 'inicio') navigation.navigate('DashboardClubHome');
    else navigation.navigate('DashboardClubHome'); // placeholder, luego mapearás a sus pantallas
  };

  return (
    <View className="flex-1 bg-[#0A0F1D]">
      {/* Topbar */}
      <View className={`${NAV_BG} h-16 w-full flex-row items-center px-6`}>
        <View className="flex-1 flex-row items-center gap-3">
          {/* Logo + nombre club */}
          <View className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-400/60 to-blue-500/60 items-center justify-center">
            <Ionicons name="tennisball-outline" size={18} color="white" />
          </View>
          <Text className="text-white text-[16px] font-semibold tracking-wide">Club Centro</Text>
        </View>

        {/* Perfil */}
        <View className="h-10 w-10 rounded-full overflow-hidden border border-white/10">
          {/* avatar demo */}
          <Image
            source={{ uri: 'https://i.pravatar.cc/100?img=12' }}
            className="h-full w-full"
            resizeMode="cover"
          />
        </View>
      </View>

      {/* Body */}
      <View className="flex-1 flex-row">
        {/* SIDEBAR */}
        <View className={`${NAV_BG} w-[240px] px-3 pt-4`}>
          <ScrollView
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Bloque de navegación */}
            <View className="mt-2">
              {items.map((it) => (
                <SidebarItem
                  key={it.key}
                  icon={it.icon}
                  label={it.label}
                  active={current === it.key}
                  onPress={() => go(it.key)}
                />
              ))}
            </View>

            {/* Divider suave */}
            <View className="h-[1px] bg-white/5 my-4" />

            {/* Cerrar sesión */}
            <Pressable
              onPress={() => navigation.navigate('Logout')}
              className="w-full rounded-xl px-3 py-3 bg-transparent"
            >
              <View className="flex-row items-center gap-3">
                <Ionicons name="log-out-outline" size={18} color="#FCA5A5" />
                <Text className="text-[15px] text-red-300/90">Cerrar sesión</Text>
              </View>
            </Pressable>
          </ScrollView>
        </View>

        {/* MAIN */}
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header de página (título + fecha) */}
          <View className="py-6">
            <Text className="text-white text-[36px] font-extrabold tracking-tight">
              Hola, {user?.nombre || 'Fernando'}
            </Text>
            <Text className="text-white/60 mt-1">lunes, 22 de abril de 2024</Text>
          </View>

          {/* GRID de cards (responsive) */}
          <View className="gap-6">
            {/* fila 1 */}
            <View className="flex-row gap-6">
              <View className={`flex-1 ${PANEL_BG} rounded-2xl p-5`}>
                <Text className="text-teal-300 font-semibold tracking-widest text-[13px]">
                  MIS CANCHAS
                </Text>
                <Text className="text-white text-[32px] mt-2 font-bold">
                  3 disponibles
                </Text>
                <Pressable className="self-start mt-4 rounded-xl px-4 py-2 bg-teal-400/20 border border-teal-300/30">
                  <Text className="text-teal-200 font-medium">VER CANCHAS</Text>
                </Pressable>
              </View>

              <View className={`flex-1 ${PANEL_BG} rounded-2xl p-5`}>
                <Text className="text-amber-300 font-semibold tracking-widest text-[13px]">
                  PRÓXIMO EVENTO
                </Text>
                <Text className="text-white text-[28px] mt-2 font-semibold">
                  Torneo de Primavera
                </Text>
                <Text className="text-white/60 mt-2">martes, 30 de abril de 2024</Text>
              </View>
            </View>

            {/* fila 2 */}
            <View className="flex-row gap-6">
              <View className={`flex-1 ${PANEL_BG} rounded-2xl p-5`}>
                <Text className="text-sky-300 font-semibold tracking-widest text-[13px]">
                  RESERVAS
                </Text>
                <Text className="text-white text-[32px] mt-2 font-bold">8 hoy</Text>
                <Text className="text-white/60 mt-1">+24 esta semana</Text>
                <Pressable className="self-start mt-4 rounded-xl px-4 py-2 bg-sky-400/15 border border-sky-300/30">
                  <Text className="text-sky-200 font-medium">VER RESERVAS</Text>
                </Pressable>
              </View>

              <View className={`flex-1 ${PANEL_BG} rounded-2xl p-5`}>
                <Text className="text-emerald-300 font-semibold tracking-widest text-[13px]">
                  ECONOMÍA
                </Text>
                <Text className="text-white text-[32px] mt-2 font-bold">
                  $14.520 este mes
                </Text>
                {/* gráfico placeholder */}
                <View className="mt-4 h-24 rounded-xl bg-white/5" />
              </View>
            </View>

            {/* fila 3 */}
            <View className="flex-row gap-6">
              <View className={`flex-1 ${PANEL_BG} rounded-2xl p-5`}>
                <Text className="text-teal-300 font-semibold tracking-widest text-[13px]">
                  EVENTOS
                </Text>
                <View className="mt-3 flex-row items-center justify-between">
                  <Text className="text-white text-[24px] font-semibold">meEquipo</Text>
                  <Ionicons name="chevron-forward" size={20} color="#9FB3C8" />
                </View>
              </View>

              <View className={`flex-1 ${PANEL_BG} rounded-2xl p-5`}>
                <Text className="text-teal-300 font-semibold tracking-widest text-[13px]">
                  EVENTOS
                </Text>
                <View className="mt-3 flex-row items-center justify-between">
                  <Text className="text-white text-[24px] font-semibold">Ranking</Text>
                  <Ionicons name="chevron-forward" size={20} color="#9FB3C8" />
                </View>
              </View>
            </View>
          </View>

          {/* children (rutas internas) */}
          {children}
        </ScrollView>
      </View>
    </View>
  );
}
