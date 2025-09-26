import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors as mcColors } from '../theme/tokens';
import { useAuth } from '../features/auth/useAuth';
import { getClubSummary } from '../lib/api';
import { InicioScreen, ReservasScreen, CanchasScreen, ConfiguracionScreen } from './dashboard';

const NAV_BG = 'bg-[#0F172A]/80';

function SidebarItem({ iconName, label, active, onPress }) {
  const theme = useTheme();
  const warnColor = theme?.colors?.mc?.warn ?? mcColors.warn;
  return (
    <Pressable
      onPress={onPress}
      className={`w-full rounded-xl px-3 py-3 mb-1.5 ${
        active ? 'bg-white/5' : 'bg-transparent'
      } hover:bg-white/10`}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View className="flex-row items-center justify-start gap-3">
        {iconName && (
          <Ionicons
            name={iconName}
            size={18}
            color={active ? warnColor : '#9FB3C8'}
          />
        )}
        <Text
          className={`text-[15px] leading-5 ${
            active ? 'text-mc-warn' : 'text-white/80'
          } hover:text-white`}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export default function DashboardShell() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [activeKey, setActiveKey] = useState('inicio');
  const [summary, setSummary] = useState({
    courtsAvailable: 0,
    reservasHoy: 0,
    reservasSemana: 0,
    economiaMes: 0,
  });
  const [err, setErr] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setActiveKey('inicio');
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getClubSummary({ clubId: user?.clubId || user?.club?.id });
        if (alive && data) {
          setSummary(data);
          setErr('');
        }
      } catch (e) {
        if (alive) setErr(e.message);
      }
    })();
    return () => { alive = false; };
  }, [user?.clubId, user?.club?.id]);

  const handleLogout = useCallback(async () => {
    setProfileMenuOpen(false);
    await logout();
  }, [logout]);

  const items = [
    { key: 'inicio', label: 'Inicio', iconName: 'home-outline' },
    { key: 'buzon', label: 'Buzón', iconName: 'mail-outline' },
    { key: 'mis-canchas', label: 'Mis Canchas', iconName: 'tennisball-outline' },
    { key: 'reservas', label: 'Reservas', iconName: 'calendar-outline' },
    { key: 'horarios', label: 'Horarios', iconName: 'time-outline' },
    { key: 'tarifas', label: 'Tarifas', iconName: 'pricetags-outline' },
    { key: 'grabaciones', label: 'Grabaciones', iconName: 'videocam-outline' },
    { key: 'eventos', label: 'Eventos', iconName: 'sparkles-outline' },
    { key: 'me-equipo', label: 'meEquipo', iconName: 'people-outline' },
    { key: 'ranking', label: 'Ranking', iconName: 'trophy-outline' },
    { key: 'conciliar', label: 'Conciliar', iconName: 'repeat-outline' },
    { key: 'configuracion', label: 'Configuración', iconName: 'settings-outline' },
    { key: 'soporte', label: 'Soporte', iconName: 'help-circle-outline' },
  ];

  const go = useCallback((key) => {
    setProfileMenuOpen(false);
    setActiveKey(key);
  }, []);

  const handleMenuAction = useCallback(
    (action) => {
      switch (action) {
        case 'inicio':
          go('inicio');
          break;
        case 'configuracion':
          go('configuracion');
          break;
        case 'logout':
          handleLogout();
          break;
        default:
          setProfileMenuOpen(false);
          break;
      }
    },
    [go, handleLogout]
  );

  const today = useMemo(() => {
    try {
      return new Date().toLocaleDateString('es-AR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      });
    } catch { return ''; }
  }, []);

  const firstName = useMemo(() => {
    const n = user?.nombre || user?.name || 'Usuario';
    return String(n).split(' ')[0];
  }, [user]);

  const screenMap = {
    inicio: InicioScreen,
    reservas: ReservasScreen,
    'mis-canchas': CanchasScreen,
    configuracion: ConfiguracionScreen,
  };
  const ScreenComponent = screenMap[activeKey] || (() => null);
  const screenProps = { summary, firstName, today, go };

  const clubLogo = user?.clubLogoUrl || user?.foto_logo;

  return (
    <View className="flex-1 bg-[#0A0F1D]">
      {/* Topbar */}
      <View
        className={`${NAV_BG} h-16 w-full flex-row items-center px-6 relative overflow-visible`}
        style={{ zIndex: 60, elevation: 60 }}
      >
        <View className="flex-1 flex-row items-center gap-3">
          {clubLogo ? (
            <Image
              source={{ uri: clubLogo }}
              className="h-8 w-8 rounded-full border border-white/10"
              resizeMode="cover"
            />
          ) : (
            <View className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-400/60 to-blue-500/60 items-center justify-center">
              <Ionicons name="tennisball-outline" size={18} color="white" />
            </View>
          )}
          <Text className="text-white text-[16px] font-semibold tracking-wide">
            {user?.clubNombre || 'Club Centro'}
          </Text>
        </View>

        <View className="relative z-50" style={{ elevation: 60, zIndex: 60 }}>
          <Pressable
            onPress={() => setProfileMenuOpen((prev) => !prev)}
            className="h-10 w-10 rounded-full overflow-hidden border border-white/10 bg-white/5"
          >
            <Image
              source={{ uri: user?.avatar || user?.clubLogoUrl || 'https://i.pravatar.cc/100?img=12' }}
              className="h-full w-full"
              resizeMode="cover"
            />
          </Pressable>
          {profileMenuOpen && (
            <View
              className="absolute right-0 mt-3 w-48 rounded-2xl border border-white/10 bg-[#0B152E] py-2 shadow-xl z-50"
              style={{ elevation: 60, zIndex: 60 }}
            >
              <Pressable
                onPress={() => handleMenuAction('inicio')}
                className="flex-row items-center gap-3 px-4 py-2 hover:bg-white/10"
              >
                <Ionicons name="home-outline" size={18} color="#E2E8F0" />
                <Text className="text-white/90 text-sm">Inicio</Text>
              </Pressable>
              <Pressable
                onPress={() => handleMenuAction('configuracion')}
                className="flex-row items-center gap-3 px-4 py-2 hover:bg-white/10"
              >
                <Ionicons name="settings-outline" size={18} color="#E2E8F0" />
                <Text className="text-white/90 text-sm">Ajustes</Text>
              </Pressable>
              <View className="h-px bg-white/10 my-1" />
              <Pressable
                onPress={() => setProfileMenuOpen(false)}
                className="flex-row items-center gap-3 px-4 py-2 hover:bg-white/10"
              >
                <Ionicons name="sparkles-outline" size={18} color="#E2E8F0" />
                <Text className="text-white/90 text-sm">Mejorar</Text>
              </Pressable>
              <Pressable
                onPress={() => setProfileMenuOpen(false)}
                className="flex-row items-center gap-3 px-4 py-2 hover:bg-white/10"
              >
                <Ionicons name="help-circle-outline" size={18} color="#E2E8F0" />
                <Text className="text-white/90 text-sm">Soporte</Text>
              </Pressable>
              <View className="h-px bg-white/10 my-1" />
              <Pressable
                onPress={() => handleMenuAction('logout')}
                className="flex-row items-center gap-3 px-4 py-2 hover:bg-white/10"
              >
                <Ionicons name="log-out-outline" size={18} color="#FCA5A5" />
                <Text className="text-red-300/90 text-sm">Cerrar sesión</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {/* Body */}
      <View className="flex-1 flex-row">
        {/* SIDEBAR */}
        <View className={`${NAV_BG} w-[240px] px-3 pt-4`}>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            <View className="mt-2">
              {items.map((it) => (
                <SidebarItem
                  key={it.key}
                  iconName={it.iconName}
                  label={it.label}
                  active={activeKey === it.key}
                  onPress={() => go(it.key)}
                />
              ))}
            </View>

            <View className="h-[1px] bg-white/5 my-4" />

            <Pressable
              onPress={handleLogout}
              className="w-full rounded-xl px-3 py-3 bg-transparent hover:bg-white/10"
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
          pointerEvents={profileMenuOpen ? 'box-none' : 'auto'}
        >
          {!!err && <Text className="text-red-400 text-center my-2">{err}</Text>}
          <ScreenComponent {...screenProps} />
        </ScrollView>
      </View>
    </View>
  );
}
