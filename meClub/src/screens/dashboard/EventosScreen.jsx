import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../features/auth/useAuth';
import ActionButton from '../../components/ActionButton';
import Card from '../../components/Card';
import CardTitle from '../../components/CardTitle';
import ScreenHeader from '../../components/ScreenHeader';

const ADV_BADGE = 'ADV';

const myEvents = [
  {
    id: 'evt-1',
    title: 'Amistoso Interclub',
    date: 'Vie 20 Sep · 19:30',
    location: 'Club Centro',
    status: 'Programado',
  },
  {
    id: 'evt-2',
    title: 'Torneo Liga Mixto',
    date: 'Sáb 28 Sep · 09:00',
    location: 'Canchas Norte',
    status: 'En curso',
  },
  {
    id: 'evt-3',
    title: 'Copa Primavera',
    date: 'Dom 06 Oct · 15:00',
    location: 'Sede Sur',
    status: 'Pausado',
  },
];

const globalEvents = [
  {
    id: 'g-1',
    title: 'Liga Provincial · Fecha 4',
    date: 'Sáb 21 Sep',
    scope: 'provincia',
    organizer: 'Federación Provincial',
  },
  {
    id: 'g-2',
    title: 'Copa Nacional Juvenil',
    date: 'Dom 29 Sep',
    scope: 'nacional',
    organizer: 'Asociación Nacional',
  },
  {
    id: 'g-3',
    title: 'Encuentro Regional',
    date: 'Vie 04 Oct',
    scope: 'provincia',
    organizer: 'Liga Metropolitana',
  },
  {
    id: 'g-4',
    title: 'Master Nacional',
    date: 'Sáb 12 Oct',
    scope: 'nacional',
    organizer: 'Comité Nacional',
  },
];

const statusStyles = {
  Programado: {
    container: 'bg-sky-500/10 border-sky-400/40',
    text: 'text-sky-100',
  },
  'En curso': {
    container: 'bg-emerald-500/10 border-emerald-400/40',
    text: 'text-emerald-100',
  },
  Pausado: {
    container: 'bg-amber-500/10 border-amber-400/40',
    text: 'text-amber-100',
  },
};

function StatusPill({ status }) {
  const styles = statusStyles[status] ?? statusStyles.Programado;
  return (
    <View className={`rounded-full px-3 py-[4px] border ${styles.container}`}>
      <Text className={`text-[12px] font-semibold ${styles.text}`} numberOfLines={1}>
        {status}
      </Text>
    </View>
  );
}

function FilterPill({ active, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full px-4 py-[6px] border ${
        active
          ? 'bg-white/10 border-white/20'
          : 'bg-transparent border-white/10 hover:bg-white/5'
      }`}
    >
      <Text className={`text-[12px] font-semibold ${active ? 'text-white' : 'text-white/70'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function EventosScreen() {
  const { user } = useAuth();
  const [filter, setFilter] = useState('provincia');
  const clubLevel = useMemo(() => {
    const parsed = Number(user?.nivel_id ?? 1);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }, [user?.nivel_id]);
  const hasProAccess = clubLevel >= 2;

  const filteredGlobalEvents = useMemo(() => {
    return globalEvents.filter((event) => event.scope === filter);
  }, [filter]);

  const lockedButtonProps = hasProAccess
    ? {
      badge: null,
      backgroundClassName: 'bg-emerald-400 hover:bg-emerald-400/80',
      className: '',
    }
    : {
      badge: ADV_BADGE,
      backgroundClassName: 'bg-mc-warn/25',
      className: 'border border-sky-400/50',
    };

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <View className="flex-1 basis-1/2">
          <ScreenHeader
            title="Eventos"
            subtitle="Gestioná eventos propios y revisá propuestas provinciales o nacionales."
            className="items-start text-left"
          />
        </View>
        <View className="flex-1 basis-1/2 items-end py-8">
          <View className="grid grid-cols-3 gap-3 self-end">
            <ActionButton
              onPress={() => {}}
              disabled={!hasProAccess}
              icon="sparkles-outline"
              label="Crear Amistoso"
              badge={lockedButtonProps.badge}
              backgroundClassName={lockedButtonProps.backgroundClassName}
              className={lockedButtonProps.className}
            />
            <ActionButton
              onPress={() => {}}
              disabled={!hasProAccess}
              icon="trophy-outline"
              label="Torneo-Liga"
              badge={lockedButtonProps.badge}
              backgroundClassName={lockedButtonProps.backgroundClassName}
              className={lockedButtonProps.className}
            />
            <ActionButton
              onPress={() => {}}
              disabled={!hasProAccess}
              icon="flag-outline"
              label="Copa"
              badge={lockedButtonProps.badge}
              backgroundClassName={lockedButtonProps.backgroundClassName}
              className={lockedButtonProps.className}
            />
          </View>
        </View>
      </View>

      <View className="gap-6 lg:flex-row">
        <View className="flex-1 gap-6">
          <Card className="gap-4 pb-6">
            <CardTitle colorClass="text-mc-info">Mis Eventos</CardTitle>
            <Text className="text-white/60">
              Organizá tus eventos internos y controlá el estado de cada convocatoria.
            </Text>
            <View className="mt-4 gap-4">
              {myEvents.map((event) => (
                <View
                  key={event.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-white font-semibold">{event.title}</Text>
                      <Text className="text-white/60 text-xs mt-1">{event.date}</Text>
                      <Text className="text-white/40 text-xs mt-1">{event.location}</Text>
                    </View>
                    <StatusPill status={event.status} />
                  </View>
                  <View className="flex-row flex-wrap gap-2 mt-4">
                    <Pressable className="rounded-full border border-white/10 px-3 py-1">
                      <Text className="text-white text-xs font-semibold">Editar</Text>
                    </Pressable>
                    <Pressable className="rounded-full border border-emerald-400/40 px-3 py-1">
                      <Text className="text-emerald-200 text-xs font-semibold">Iniciar</Text>
                    </Pressable>
                    <Pressable className="rounded-full border border-amber-400/40 px-3 py-1">
                      <Text className="text-amber-200 text-xs font-semibold">Pausar</Text>
                    </Pressable>
                    <Pressable className="rounded-full border border-rose-500/40 px-3 py-1">
                      <Text className="text-rose-200 text-xs font-semibold">Eliminar</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </View>

        <View className="flex-1 gap-6">
          <Card className="gap-4 pb-6">
            <View className="flex-row items-center justify-between gap-3">
              <CardTitle colorClass="text-mc-info">Eventos Globales</CardTitle>
              <View className="flex-row gap-2">
                <FilterPill
                  label="Provincia"
                  active={filter === 'provincia'}
                  onPress={() => setFilter('provincia')}
                />
                <FilterPill
                  label="Nacional"
                  active={filter === 'nacional'}
                  onPress={() => setFilter('nacional')}
                />
              </View>
            </View>
            <Text className="text-white/60">
              Explorá convocatorias oficiales y definí tu participación según región.
            </Text>
            <View className="mt-4 gap-4">
              {filteredGlobalEvents.map((event) => (
                <View
                  key={event.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-white font-semibold">{event.title}</Text>
                      <Text className="text-white/60 text-xs mt-1">{event.date}</Text>
                      <Text className="text-white/40 text-xs mt-1">{event.organizer}</Text>
                    </View>
                    <View className="h-9 w-9 rounded-full bg-white/5 border border-white/10 items-center justify-center">
                      <Ionicons name="calendar-outline" size={18} color="#E2E8F0" />
                    </View>
                  </View>
                  <View className="flex-row flex-wrap gap-2 mt-4">
                    <Pressable className="rounded-full border border-white/10 px-3 py-1">
                      <Text className="text-white text-xs font-semibold">Ver detalles</Text>
                    </Pressable>
                    <Pressable className="rounded-full border border-white/10 px-3 py-1">
                      <Text className="text-white text-xs font-semibold">Postular club</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </View>
      </View>
    </ScrollView>
  );
}
