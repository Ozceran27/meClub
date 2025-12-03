import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Platform } from 'react-native';
import { useNavigation, useTheme } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors as mcColors } from '../theme/tokens';
import { useAuth } from '../features/auth/useAuth';
import { getClubSummary, getInboxSummary } from '../lib/api';
import {
  InicioScreen,
  ReservasScreen,
  CanchasScreen,
  ConfiguracionScreen,
  EconomiaScreen,
  BuzonScreen,
} from './dashboard';
import WorkInProgressScreen from './WorkInProgressScreen';

const NAV_BG = 'bg-[#0F172A]/80';

function SidebarItem({ iconName, label, active, onPress, minLevel = 1, disabled = false, badge }) {
  const theme = useTheme();
  const warnColor = theme?.colors?.mc?.warn ?? mcColors.warn;
  const iconColor = disabled ? '#64748B' : active ? warnColor : '#9FB3C8';
  const textColorClass = disabled
    ? 'text-white/40'
    : active
      ? 'text-mc-warn'
      : 'text-white/80';
  const computedBadge = badge ?? (minLevel > 1 ? 'PRO' : undefined);
  const isBadgeElement = React.isValidElement(computedBadge);
  const badgeText = !isBadgeElement && computedBadge != null ? String(computedBadge) : '';
  const isProBadge = badgeText === 'PRO';
  const badgeContent = isBadgeElement
    ? computedBadge
    : badgeText
      ? (
        <View
          className={`rounded-full px-2 py-[2px] border ${
            isProBadge ? 'bg-amber-500/20 border-amber-400/50' : 'bg-rose-500/20 border-rose-400/60'
          }`}
          accessible
          accessibilityLabel={isProBadge ? 'Funcionalidad PRO' : `${badgeText} notificaciones`}
          aria-label={isProBadge ? 'Funcionalidad PRO' : `${badgeText} notificaciones`}
        >
          <Text className={`text-[10px] font-semibold ${isProBadge ? 'text-amber-300' : 'text-rose-100'}`}>{badgeText}</Text>
        </View>
      )
      : null;

  const accessibilityLabel = `${label}${
    badgeText
      ? isProBadge
        ? ', sección PRO'
        : `, ${badgeText} notificaciones`
      : ''
  }${disabled ? ', deshabilitado' : ''}`;

  return (
    <Pressable
      onPress={() => { if (!disabled) onPress?.(); }}
      disabled={disabled}
      className={`w-full rounded-xl px-3 py-3 mb-1.5 ${
        active ? 'bg-white/5' : 'bg-transparent'
      } hover:bg-white/10 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      accessibilityLabel={accessibilityLabel}
      aria-label={accessibilityLabel}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-3 flex-1">
          {iconName && (
            <Ionicons
              name={iconName}
              size={18}
              color={iconColor}
            />
          )}
          <Text
            className={`text-[15px] leading-5 ${textColorClass} hover:text-white`}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
        {badgeContent}
      </View>
    </Pressable>
  );
}

export default function DashboardShell() {
  const navigation = useNavigation();
  const { user, ready, logout } = useAuth();
  const [activeKey, setActiveKey] = useState('inicio');
  const [unreadCount, setUnreadCount] = useState(0);
  const [summary, setSummary] = useState({
    courtsAvailable: 0,
    courtsMaintenance: 0,
    courtsInactive: 0,
    reservasHoy: 0,
    reservasSemana: 0,
    economiaMes: 0,
    courtTypes: [],
    reservasPagadasHoy: 0,
    reservasFinalizadasHoy: 0,
    reservasMesActual: 0,
    reservasDiarias: [],
    reservasMensuales: [],
    weatherStatus: null,
    weatherTemp: null,
    ingresosProyectadosMes: 0,
    ingresosRealesMes: 0,
    gastosMes: 0,
    economiaMensual: [],
  });
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const clubId = useMemo(() => {
    const parsed = Number(user?.clubId ?? user?.club?.club_id ?? user?.club?.id);
    return Number.isFinite(parsed) ? parsed : null;
  }, [user?.club?.club_id, user?.club?.id, user?.clubId]);
  const updateUnreadCount = useCallback((nextValue) => {
    setUnreadCount((prev) => {
      const resolved = typeof nextValue === 'function' ? nextValue(prev) : nextValue;
      const numeric = typeof resolved === 'string' ? Number.parseInt(resolved, 10) : resolved;
      const normalized = Number.isFinite(numeric) ? numeric : 0;
      return normalized < 0 ? 0 : normalized;
    });
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setActiveKey('inicio');
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!ready) return;
      if (!clubId) {
        setSummary((prev) => ({ ...prev, economiaMes: 0 }));
        setErr('No encontramos el club asociado a tu perfil');
        return;
      }
      try {
        setSummaryLoading(true);
        const data = await getClubSummary({ clubId });
        if (alive && data) {
          setSummary(data);
          setErr('');
        }
      } catch (e) {
        if (alive) setErr(e.message);
      } finally {
        if (alive) setSummaryLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [clubId, ready]);

  const refreshInboxSummary = useCallback(async () => {
    try {
      const summaryResponse = await getInboxSummary();
      updateUnreadCount(summaryResponse?.unreadCount ?? 0);
      return summaryResponse;
    } catch {
      return null;
    }
  }, [updateUnreadCount]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) {
        updateUnreadCount(0);
        return;
      }
      try {
        const summaryResponse = await getInboxSummary();
        if (alive) {
          updateUnreadCount(summaryResponse?.unreadCount ?? 0);
        }
      } catch {
        // Ignorado para no bloquear el resto del dashboard
      }
    })();
    return () => { alive = false; };
  }, [updateUnreadCount, user]);

  const handleLogout = useCallback(async () => {
    setProfileMenuOpen(false);
    await logout();
  }, [logout]);

  const inboxBadge = useMemo(() => {
    if (unreadCount <= 0) return undefined;
    if (unreadCount > 9) {
      return String(Math.min(unreadCount, 99));
    }
    const label = unreadCount === 1
      ? '1 mensaje sin leer'
      : `${unreadCount} mensajes sin leer`;
    return (
      <View
        className="h-2.5 w-2.5 rounded-full bg-rose-400"
        accessible
        accessibilityLabel={label}
        aria-label={label}
      />
    );
  }, [unreadCount]);

  const items = useMemo(() => ([
    { key: 'inicio', label: 'Inicio', iconName: 'home-outline', minLevel: 1 },
    { key: 'buzon', label: 'Buzón', iconName: 'mail-outline', minLevel: 1, badge: inboxBadge },
    { key: 'mis-canchas', label: 'Mis Canchas', iconName: 'tennisball-outline', minLevel: 1 },
    { key: 'reservas', label: 'Reservas', iconName: 'calendar-outline', minLevel: 1 },
    { key: 'economia', label: 'Economía', iconName: 'cash-outline', minLevel: 1 },
    { key: 'tarifas', label: 'Tarifas', iconName: 'pricetags-outline', minLevel: 1 },
    { key: 'grabaciones', label: 'Grabaciones', iconName: 'videocam-outline', minLevel: 2 },
    { key: 'eventos', label: 'Eventos', iconName: 'sparkles-outline', minLevel: 1, badge: 'PRO' },
    { key: 'me-equipo', label: 'meEquipo', iconName: 'people-outline', minLevel: 2 },
    { key: 'ranking', label: 'Ranking', iconName: 'trophy-outline', minLevel: 2 },
    { key: 'configuracion', label: 'Configuración', iconName: 'settings-outline', minLevel: 1 },
    { key: 'soporte', label: 'Soporte', iconName: 'help-circle-outline', minLevel: 1 },
  ]), [inboxBadge]);

  const clubLevel = useMemo(() => {
    const parsed = Number(user?.nivel_id ?? 1);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }, [user?.nivel_id]);

  const go = useCallback((keyOrItem) => {
    const item = typeof keyOrItem === 'string'
      ? items.find((it) => it.key === keyOrItem)
      : keyOrItem;
    const key = item?.key || keyOrItem;
    const minLevel = item?.minLevel ?? 1;

    if (clubLevel < minLevel) {
      setNotice(`Esta sección requiere nivel ${minLevel}. Tu nivel actual es ${clubLevel}.`);
      return;
    }

    setNotice('');
    setProfileMenuOpen(false);
    setActiveKey(key);
  }, [clubLevel, items]);

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
    economia: EconomiaScreen,
    buzon: BuzonScreen,
  };
  const ScreenComponent = screenMap[activeKey] || WorkInProgressScreen;
  const screenProps = {
    summary,
    summaryLoading,
    summaryError: err,
    firstName,
    today,
    go,
    unreadCount,
    onUnreadCountChange: updateUnreadCount,
    refreshInboxSummary,
  };

  const clubLogo = user?.clubLogoUrl || user?.foto_logo;
  const scrollPointerEvents = profileMenuOpen ? 'box-none' : 'auto';
  const scrollViewProps =
    Platform.OS === 'web'
      ? { style: { pointerEvents: scrollPointerEvents === 'box-none' ? 'none' : 'auto' } }
      : { pointerEvents: scrollPointerEvents };

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
                  minLevel={it.minLevel}
                  badge={it.badge}
                  disabled={clubLevel < it.minLevel}
                  onPress={() => go(it)}
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
          {...scrollViewProps}
        >
          {!!err && <Text className="text-red-400 text-center my-2">{err}</Text>}
          {!!notice && <Text className="text-amber-300 text-center my-2">{notice}</Text>}
          <ScreenComponent {...screenProps} />
        </ScrollView>
      </View>
    </View>
  );
}
