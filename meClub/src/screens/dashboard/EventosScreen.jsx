import React, { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../features/auth/useAuth';
import {
  api,
  fetchClubCourts,
  fetchSports,
  resolveAssetUrl,
  searchTeams,
  uploadEventImage,
} from '../../lib/api';
import ActionButton from '../../components/ActionButton';
import Card from '../../components/Card';
import CardTitle from '../../components/CardTitle';
import ModalContainer from '../../components/ModalContainer';
import ScreenHeader from '../../components/ScreenHeader';

const ADV_BADGE = 'ADV';
const FRIENDLY_DEFAULT_IMAGE = require('../../../assets/Amistoso_predeterm..png');

const STATUS_LABELS = {
  inactivo: 'Inactivo',
  activo: 'En curso',
  pausado: 'Pausado',
  finalizado: 'Finalizado',
};

const resolveStatusLabel = (status) => {
  if (!status) return 'Programado';
  const normalized = String(status).toLowerCase();
  return STATUS_LABELS[normalized] ?? status;
};

const EVENT_TYPE_LABELS = {
  amistoso: 'AMISTOSO',
  torneo: 'TORNEO',
  copa: 'COPA',
};

const ZONE_OPTIONS = [
  { value: 'regional', label: 'Regional' },
  { value: 'nacional', label: 'Nacional' },
];

const resolveEventTypeLabel = (type) => {
  if (!type) return '';
  const normalized = String(type).trim().toLowerCase();
  return EVENT_TYPE_LABELS[normalized] ?? normalized.toUpperCase();
};

const resolveEventDetailType = (type) => {
  if (!type) return 'amistoso';
  const normalized = String(type).trim().toLowerCase();
  if (normalized === 'liga') return 'torneo';
  if (['amistoso', 'torneo', 'copa'].includes(normalized)) return normalized;
  return normalized;
};

const resolveEventDetailsEndpoint = (event) => {
  const isGlobal = Boolean(event?.isGlobal) || Boolean(event?.scope);
  return isGlobal ? `/eventos/globales/${event.id}` : `/eventos/${event.id}`;
};

const resolveGlobalScope = (zona) => {
  const normalized = String(zona ?? '').toLowerCase();
  if (['regional', 'provincial', 'provincia'].includes(normalized)) return 'provincia';
  return 'nacional';
};

const normalizeZoneValue = (zona) => {
  const normalized = String(zona ?? '').trim().toLowerCase();
  if (['regional', 'provincial', 'provincia'].includes(normalized)) return 'regional';
  if (normalized === 'nacional') return 'nacional';
  return 'regional';
};

const normalizeVenueIds = (sedes) => {
  if (!Array.isArray(sedes)) return [];
  const ids = sedes
    .map((sede) => {
      if (typeof sede === 'number' || typeof sede === 'string') {
        const parsed = Number(sede);
        return Number.isFinite(parsed) ? parsed : null;
      }
      const parsed = Number(sede?.cancha_id ?? sede?.canchaId ?? sede?.id);
      return Number.isFinite(parsed) ? parsed : null;
    })
    .filter((value) => value !== null);
  return Array.from(new Set(ids));
};

const formatEventDate = (value) => {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
};

const formatEventRange = (start, end) => {
  const startLabel = formatEventDate(start);
  const endLabel = formatEventDate(end);
  if (!start && !end) return 'Sin fecha';
  if (!start) return endLabel;
  if (!end || startLabel === endLabel) return startLabel;
  return `${startLabel} - ${endLabel}`;
};

const formatEventTime = (value) => {
  if (!value) return '';
  const normalized = String(value);
  if (normalized.length >= 5) {
    return normalized.slice(0, 5);
  }
  return normalized;
};

const isValidDate = (value) => {
  if (!value) return false;
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(year, month - 1, day);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

const formatDateInput = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeDateInputValue = (value) => {
  if (!value) return '';
  if (isValidDate(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return formatDateInput(parsed);
};

const parseDateInput = (value) => {
  if (!isValidDate(value)) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatCurrencyValue = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const numeric = Number(digits);
  if (!Number.isFinite(numeric)) return '';
  return `$ ${numeric.toLocaleString('es-AR')}`;
};

const resolveLocationLabel = (evento) => {
  if (evento?.descripcion) return evento.descripcion;
  if (evento?.zona) return `Zona ${evento.zona}`;
  if (evento?.provincia_id) return `Provincia ${evento.provincia_id}`;
  return 'Sin descripción';
};

const resolveOrganizer = (evento) => {
  if (evento?.club_nombre) return evento.club_nombre;
  if (evento?.organizador) return evento.organizador;
  if (evento?.club_id) return `Club ${evento.club_id}`;
  return 'Organización';
};

const resolveFriendlyTeams = (evento) => {
  const equipos = Array.isArray(evento?.equipos) ? [...evento.equipos] : [];
  if (equipos.length === 0) {
    return {
      team1: '',
      team1Id: '',
      team2: '',
      team2Id: '',
    };
  }
  const sorted = equipos.sort((a, b) => {
    const aTime = new Date(a?.creado_en ?? 0).getTime();
    const bTime = new Date(b?.creado_en ?? 0).getTime();
    return aTime - bTime;
  });
  const [team1, team2] = sorted;
  return {
    team1: team1?.nombre_equipo ?? team1?.nombre ?? '',
    team1Id: team1?.equipo_id ?? '',
    team2: team2?.nombre_equipo ?? team2?.nombre ?? '',
    team2Id: team2?.equipo_id ?? '',
  };
};

const resolveEquipoName = (equipos, equipoId) => {
  const equipo = equipos.find(
    (item) => String(item?.equipo_id ?? item?.equipoId ?? item?.id) === String(equipoId)
  );
  return (
    equipo?.nombre_equipo ??
    equipo?.nombre ??
    (equipoId ? `Equipo ${equipoId}` : '')
  );
};

const normalizeScoreValue = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeNumberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseCurrencyInput = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveDateRangeInput = (formValues, fallbackStart, fallbackEnd) => {
  const explicitStart = formValues?.startDate ?? formValues?.fecha_inicio ?? '';
  const explicitEnd = formValues?.endDate ?? formValues?.fecha_fin ?? '';
  if (explicitStart || explicitEnd) {
    return {
      startDate: explicitStart || null,
      endDate: explicitEnd || null,
    };
  }
  const rawDates = String(formValues?.dates ?? '').trim();
  if (!rawDates) {
    return {
      startDate: fallbackStart || null,
      endDate: fallbackEnd || null,
    };
  }
  const separator = rawDates.includes(' - ') ? ' - ' : null;
  if (!separator) {
    return {
      startDate: rawDates,
      endDate: fallbackEnd || null,
    };
  }
  const [start, end] = rawDates.split(separator).map((value) => value.trim());
  return {
    startDate: start || fallbackStart || null,
    endDate: end || fallbackEnd || null,
  };
};

const resolveFriendlyMatch = (evento) => {
  const partidos = Array.isArray(evento?.partidos) ? evento.partidos : [];
  if (partidos.length === 0) return null;
  const match =
    partidos.find((partido) => String(partido?.fase ?? '').toLowerCase() === 'amistoso') ??
    partidos[0];
  if (!match) return null;
  return {
    matchId: match?.evento_partido_id ?? match?.partido_id ?? match?.id ?? null,
    marcador_local: match?.marcador_local ?? match?.goles_local ?? null,
    marcador_visitante: match?.marcador_visitante ?? match?.goles_visitante ?? null,
    equipo_local_id: match?.equipo_local_id ?? match?.equipoLocalId ?? null,
    equipo_visitante_id: match?.equipo_visitante_id ?? match?.equipoVisitanteId ?? null,
    ganador_equipo_id: match?.ganador_equipo_id ?? match?.ganadorEquipoId ?? null,
    estado: match?.estado ?? null,
  };
};

const buildMatchResult = (evento) => {
  const equipos = Array.isArray(evento?.equipos) ? evento.equipos : [];
  const friendlyTeams = resolveFriendlyTeams({ equipos });
  const match = resolveFriendlyMatch(evento);
  const team1Score = match?.marcador_local ?? null;
  const team2Score = match?.marcador_visitante ?? null;
  const hasTeams = Boolean(friendlyTeams.team1 || friendlyTeams.team2);
  const hasScores = team1Score !== null || team2Score !== null;
  if (!hasTeams && !hasScores) return null;
  return {
    team1: friendlyTeams.team1,
    team2: friendlyTeams.team2,
    team1Score,
    team2Score,
    matchId: match?.matchId ?? null,
    winnerId: match?.ganador_equipo_id ?? null,
  };
};

const buildStandings = (evento) => {
  const equipos = Array.isArray(evento?.equipos) ? evento.equipos : [];
  const posiciones = Array.isArray(evento?.posiciones) ? evento.posiciones : [];
  if (posiciones.length === 0) return [];
  return posiciones.map((posicion, index) => ({
    id: posicion?.evento_posicion_id ?? posicion?.equipo_id ?? `st-${index}`,
    team: resolveEquipoName(equipos, posicion?.equipo_id) || `Equipo ${index + 1}`,
    played: posicion?.partidos_jugados ?? 0,
    points: posicion?.puntos ?? 0,
  }));
};

const buildBracket = (evento) => {
  const equipos = Array.isArray(evento?.equipos) ? evento.equipos : [];
  const partidos = Array.isArray(evento?.partidos) ? evento.partidos : [];
  if (partidos.length === 0) return [];
  const matchesByFase = partidos.reduce((acc, partido) => {
    const fase = String(partido?.fase ?? '').toLowerCase();
    if (!fase) return acc;
    if (!acc[fase]) acc[fase] = [];
    acc[fase].push(partido);
    return acc;
  }, {});

  return DEFAULT_BRACKET.map((round) => {
    const faseKey = String(round?.name ?? '').toLowerCase();
    const roundMatches = matchesByFase[faseKey];
    if (!roundMatches || roundMatches.length === 0) {
      return {
        ...round,
        matches: round.matches.map((match) => ({ ...match })),
      };
    }
    const mappedMatches = [...roundMatches]
      .sort((a, b) => {
        const orderA = a?.orden ?? 0;
        const orderB = b?.orden ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return (a?.evento_partido_id ?? 0) - (b?.evento_partido_id ?? 0);
      })
      .map((match, index) => ({
        id: match?.evento_partido_id ?? `${faseKey}-${index}`,
        teamA: resolveEquipoName(equipos, match?.equipo_local_id) || '—',
        teamB: resolveEquipoName(equipos, match?.equipo_visitante_id) || '—',
        winner: resolveEquipoName(equipos, match?.ganador_equipo_id) || '',
      }));
    return { ...round, matches: mappedMatches };
  });
};

const mapGlobalEvent = (evento) => ({
  id: evento?.evento_id ?? evento?.id ?? `global-${Math.random()}`,
  title: evento?.nombre ?? 'Evento',
  date: formatEventDate(evento?.fecha_inicio ?? evento?.fecha_fin),
  scope: resolveGlobalScope(evento?.zona),
  isGlobal: true,
  organizer: resolveOrganizer(evento),
  type: evento?.tipo ?? 'amistoso',
  status: evento?.estado ?? 'programado',
  startDate: evento?.fecha_inicio ?? '',
  endDate: evento?.fecha_fin ?? '',
  time: formatEventTime(evento?.hora_inicio),
  location: resolveLocationLabel(evento),
  price: evento?.valor_inscripcion ?? '',
  prize: evento?.premio_1 ?? '',
  imageUrl: evento?.imagen_url ?? '',
  matchResult: evento?.matchResult,
  standings: evento?.standings,
  bracket: evento?.bracket,
});

const mapClubEvent = (evento) => ({
  id: evento?.evento_id ?? evento?.id ?? `event-${Math.random()}`,
  title: evento?.nombre ?? 'Evento',
  date: formatEventRange(evento?.fecha_inicio, evento?.fecha_fin),
  location: resolveLocationLabel(evento),
  isGlobal: false,
  type: evento?.tipo ?? 'amistoso',
  status: evento?.estado ?? 'programado',
  startDate: evento?.fecha_inicio ?? '',
  endDate: evento?.fecha_fin ?? '',
  time: formatEventTime(evento?.hora_inicio),
  sport: evento?.deporte_id ?? '',
  prize: evento?.premio_1 ?? '',
  venue: evento?.descripcion ?? '',
  venues: normalizeVenueIds(evento?.sedes),
  imageUrl: evento?.imagen_url ?? '',
  raw: evento,
});

const normalizeStatus = (status) => String(status ?? '').toLowerCase();

const STATUS_ORDER = {
  inactivo: 0,
  activo: 1,
  pausado: 2,
  finalizado: 3,
};

const DEFAULT_STANDINGS = [
  { id: 'st-1', team: 'Club Centro', played: 3, points: 7 },
  { id: 'st-2', team: 'Atlético Norte', played: 3, points: 6 },
  { id: 'st-3', team: 'Deportivo Sur', played: 3, points: 4 },
  { id: 'st-4', team: 'Social Este', played: 3, points: 3 },
  { id: 'st-5', team: 'Unión Oeste', played: 3, points: 1 },
];

const DEFAULT_BRACKET = [
  {
    name: 'Cuartos',
    matches: [
      { id: 'qf-1', teamA: 'Club Centro', teamB: 'Unión Oeste', winner: '' },
      { id: 'qf-2', teamA: 'Atlético Norte', teamB: 'Social Este', winner: '' },
      { id: 'qf-3', teamA: 'Deportivo Sur', teamB: 'Club Andes', winner: '' },
      { id: 'qf-4', teamA: 'Juventud', teamB: 'San Martín', winner: '' },
    ],
  },
  {
    name: 'Semifinal',
    matches: [
      { id: 'sf-1', teamA: '—', teamB: '—', winner: '' },
      { id: 'sf-2', teamA: '—', teamB: '—', winner: '' },
    ],
  },
  {
    name: 'Final',
    matches: [{ id: 'f-1', teamA: '—', teamB: '—', winner: '' }],
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
  Finalizado: {
    container: 'bg-indigo-500/10 border-indigo-400/40',
    text: 'text-indigo-100',
  },
  Inactivo: {
    container: 'bg-rose-500/10 border-rose-400/40',
    text: 'text-rose-100',
  },
};

function StatusPill({ status }) {
  const label = resolveStatusLabel(status);
  const styles = statusStyles[label] ?? statusStyles.Programado;
  return (
    <View className={`rounded-full px-3 py-[4px] border ${styles.container}`}>
      <Text className={`text-[12px] font-semibold ${styles.text}`} numberOfLines={1}>
        {label}
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

const FORM_FIELD_CLASSNAME =
  'min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white';

const WebDateInput = ({ value, onChange, placeholder, className, disabled }) => {
  if (Platform.OS === 'web') {
    return (
      <input
        type="date"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        disabled={disabled}
      />
    );
  }

  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#94A3B8"
      className={className}
      autoCorrect={false}
      autoCapitalize="none"
      editable={!disabled}
    />
  );
};

const EVENT_DATE_OPTIONS = (() => {
  const formatter = new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
  return Array.from({ length: 45 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    const value = date.toISOString().slice(0, 10);
    return {
      value,
      label: formatter.format(date),
    };
  });
})();

const EVENT_TIME_OPTIONS = Array.from({ length: 30 }, (_, index) => {
  const hours = Math.floor(index / 2) + 8;
  const minutes = index % 2 === 0 ? '00' : '30';
  const label = `${String(hours).padStart(2, '0')}:${minutes}`;
  return { value: label, label };
});

const formatTimeInput = (input) => {
  const digits = String(input ?? '').replace(/\D/g, '').slice(0, 4);
  if (!digits) {
    return { formatted: '', isComplete: false, isValid: false };
  }
  if (digits.length <= 2) {
    return { formatted: digits, isComplete: false, isValid: false };
  }
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2, 4));
  const formatted = `${digits.slice(0, 2)}:${digits.slice(2)}`;
  const isComplete = digits.length === 4;
  const isValid = isComplete && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  return { formatted, isComplete, isValid };
};

function FormField({ label, placeholder, value, onChangeText, editable = true, keyboardType }) {
  return (
    <View className="gap-2">
      <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">{label}</Text>
      <TextInput
        className={FORM_FIELD_CLASSNAME}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function OptionPill({ label, active, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`rounded-full border px-3 py-1 ${
        active
          ? 'border-emerald-400/60 bg-emerald-500/10'
          : 'border-white/10 bg-white/5'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <Text className="text-xs font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

function ModalHeader({ title, subtitle, onClose }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <View className="flex-1 gap-1">
        <Text className="text-white text-lg font-semibold">{title}</Text>
        {subtitle ? <Text className="text-white/60 text-xs">{subtitle}</Text> : null}
      </View>
      <Pressable onPress={onClose} className="h-9 w-9 items-center justify-center rounded-full bg-white/5">
        <Ionicons name="close" size={18} color="#E2E8F0" />
      </Pressable>
    </View>
  );
}

function EventDetail({ label, value }) {
  if (!value) return null;
  return (
    <View className="flex-row flex-wrap items-center gap-1">
      <Text className="text-[10px] uppercase tracking-wide text-white/50">{label}:</Text>
      <Text className="text-xs text-white/80">{value}</Text>
    </View>
  );
}

function EventActionButton({ label, borderClassName, iconName, iconColor, onPress }) {
  const [isHovered, setIsHovered] = useState(false);
  const tooltipEnabled = Platform.OS === 'web';
  const showTooltip = tooltipEnabled && isHovered;
  const handleHoverIn = tooltipEnabled ? () => setIsHovered(true) : undefined;
  const handleHoverOut = tooltipEnabled ? () => setIsHovered(false) : undefined;
  const handleFocus = tooltipEnabled ? () => setIsHovered(true) : undefined;
  const handleBlur = tooltipEnabled ? () => setIsHovered(false) : undefined;

  return (
    <View className="relative items-center">
      <Pressable
        className={`h-9 w-9 items-center justify-center rounded-xl border ${borderClassName}`}
        onPress={onPress}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        onFocus={handleFocus}
        onBlur={handleBlur}
        accessibilityLabel={label}
        title={label}
      >
        <Ionicons name={iconName} size={18} color={iconColor} />
      </Pressable>
      {showTooltip ? (
        <View
          pointerEvents="none"
          className="absolute top-full z-20 mt-1 rounded-lg border border-white/20 bg-slate-950/95 px-2 py-2 shadow-lg shadow-black/40"
        >
          <Text className="text-[11px] font-semibold text-white">{label}</Text>
        </View>
      ) : null}
    </View>
  );
}

function EventCard({ event, onPress, onEdit, onStart, onPause, onDelete }) {
  const isCupOrTournament = ['copa', 'torneo', 'liga'].includes(String(event?.type ?? ''));
  const startDateLabel = event?.startDate ? formatEventDate(event.startDate) : event?.date;
  const endDateLabel = isCupOrTournament && event?.endDate ? formatEventDate(event.endDate) : '';
  const dateLabel =
    endDateLabel && startDateLabel ? `${startDateLabel} - ${endDateLabel}` : startDateLabel;
  const imageStyle = Platform.select({ web: { objectFit: 'contain' } });
  const prizeDetail = event?.prize
    ? {
      label: isCupOrTournament ? '1° premio' : 'Premio',
      value: formatCurrencyValue(event.prize),
    }
    : null;
  const imageSource =
    event?.type === 'amistoso'
      ? FRIENDLY_DEFAULT_IMAGE
      : event?.imageUrl
        ? { uri: resolveAssetUrl(event.imageUrl) }
        : null;

  return (
    <Pressable
      className="rounded-2xl border border-white/10 bg-white/5 p-4"
      onPress={onPress}
    >
      <View className="flex-row items-stretch gap-4">
        <View className="w-24">
          <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            {imageSource ? (
              <Image
                source={imageSource}
                className="h-full w-full"
                resizeMode="contain"
                style={imageStyle}
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Ionicons name="image-outline" size={24} color="#94A3B8" />
              </View>
            )}
          </View>
        </View>
        <View className="flex-1 gap-2">
          <Text className="text-white font-semibold text-base">{event.title}</Text>
          <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2">
            <EventDetail label="Fechas" value={dateLabel} />
            {event?.time ? <EventDetail label="Hora" value={event.time} /> : null}
          </View>
          <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2">
            <EventDetail label="Sedes" value={event.location} />
            {prizeDetail ? (
              <EventDetail label={prizeDetail.label} value={prizeDetail.value} />
            ) : null}
          </View>
        </View>
        <View className="w-36 justify-center">
          <View className="grid grid-cols-2 gap-x-1 gap-y-2">
            <EventActionButton
              label="Iniciar"
              borderClassName="border-emerald-400/40"
              iconName="play"
              iconColor="#A7F3D0"
              onPress={onStart}
            />
            <EventActionButton
              label="Pausar"
              borderClassName="border-amber-400/40"
              iconName="pause"
              iconColor="#FCD34D"
              onPress={onPause}
            />
            <EventActionButton
              label="Editar"
              borderClassName="border-white/10"
              iconName="create-outline"
              iconColor="#F8FAFC"
              onPress={onEdit}
            />
            <EventActionButton
              label="Eliminar"
              borderClassName="border-rose-500/40"
              iconName="trash-outline"
              iconColor="#FECACA"
              onPress={onDelete}
            />
          </View>
        </View>
        <View className="w-24 items-end">
          <StatusPill status={event.status} />
        </View>
      </View>
    </Pressable>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <View className="gap-1">
      <Text className="text-white text-sm font-semibold">{title}</Text>
      {subtitle ? <Text className="text-white/50 text-xs">{subtitle}</Text> : null}
    </View>
  );
}

function GlobalEventModal({ event, detailStatus, onClose }) {
  const dateLabel = formatEventRange(event?.startDate, event?.endDate);
  const timeLabel = event?.time ? formatEventTime(event.time) : '';
  const priceLabel = formatCurrencyValue(event?.price);
  const prizeLabel = formatCurrencyValue(event?.prize);
  const normalizedType = resolveEventDetailType(event?.type);
  const matchResult = event?.matchResult;
  const standings = Array.isArray(event?.standings) ? event.standings : [];
  const bracket = Array.isArray(event?.bracket) ? event.bracket : [];
  const hasMatchResult = Boolean(
    matchResult &&
      (matchResult.team1 ||
        matchResult.team2 ||
        matchResult.team1Score !== null ||
        matchResult.team2Score !== null)
  );
  const hasStandings = standings.length > 0;
  const hasBracket = bracket.length > 0;

  return (
    <ModalContainer
      visible={Boolean(event)}
      onRequestClose={onClose}
      containerClassName="w-full max-w-2xl"
    >
      <View className="gap-5 rounded-3xl border border-white/10 bg-mc-surface p-6 shadow-xl">
        <ModalHeader
          title={event?.title ?? 'Evento global'}
          subtitle="Detalles del evento global."
          onClose={onClose}
        />
        <View className="gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <SectionTitle title="Información general" />
          <View className="gap-2">
            <EventDetail label="Fechas" value={dateLabel} />
            {timeLabel ? <EventDetail label="Hora" value={timeLabel} /> : null}
            <EventDetail label="Ubicación/descr." value={event?.location ?? 'Sin descripción'} />
            {priceLabel ? (
              <EventDetail label="Precio inscripción" value={priceLabel} />
            ) : null}
            {prizeLabel ? <EventDetail label="Premio" value={prizeLabel} /> : null}
            <EventDetail label="Estado" value={resolveStatusLabel(event?.status)} />
            <EventDetail label="Tipo" value={event?.type ?? 'Sin definir'} />
            <EventDetail label="Club organizador" value={event?.organizer ?? 'Sin definir'} />
          </View>
        </View>
        {detailStatus?.loading ? (
          <View className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <Text className="text-white/70 text-sm">Cargando detalles...</Text>
          </View>
        ) : null}
        {detailStatus?.error ? (
          <View className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4">
            <Text className="text-rose-100 text-sm">{detailStatus.error}</Text>
          </View>
        ) : null}
        {!detailStatus?.loading && !detailStatus?.error && normalizedType === 'amistoso' ? (
          <View className="gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <SectionTitle title="Resultado" subtitle="Marcador final del amistoso." />
            {hasMatchResult ? (
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-white text-sm font-semibold">
                    {matchResult?.team1 || 'Equipo 1'}
                  </Text>
                  <Text className="text-white/40 text-xs">Equipo 1</Text>
                </View>
                <View className="items-center">
                  <Text className="text-white/70 text-xs font-semibold">VS</Text>
                  <Text className="text-white text-lg font-semibold">
                    {matchResult?.team1Score ?? '-'} : {matchResult?.team2Score ?? '-'}
                  </Text>
                </View>
                <View className="flex-1 items-end">
                  <Text className="text-white text-sm font-semibold">
                    {matchResult?.team2 || 'Equipo 2'}
                  </Text>
                  <Text className="text-white/40 text-xs">Equipo 2</Text>
                </View>
              </View>
            ) : (
              <Text className="text-white/60 text-sm">Sin resultados disponibles.</Text>
            )}
          </View>
        ) : null}
        {!detailStatus?.loading && !detailStatus?.error && normalizedType === 'torneo' ? (
          <View className="gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <SectionTitle title="Tabla de posiciones" subtitle="Equipos y puntos acumulados." />
            {hasStandings ? (
              <View className="gap-2">
                {standings.map((row, index) => (
                  <View
                    key={row.id ?? `${row.team}-${index}`}
                    className="flex-row items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <View className="flex-1">
                      <Text className="text-white text-xs font-semibold">{row.team}</Text>
                      <Text className="text-white/40 text-[10px]">
                        PJ {row.played ?? 0}
                      </Text>
                    </View>
                    <Text className="text-white text-xs font-semibold">{row.points ?? 0} pts</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-white/60 text-sm">Sin resultados disponibles.</Text>
            )}
          </View>
        ) : null}
        {!detailStatus?.loading && !detailStatus?.error && normalizedType === 'copa' ? (
          <View className="gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <SectionTitle title="Fixture" subtitle="Cruces y ganadores por ronda." />
            {hasBracket ? (
              <View className="gap-4">
                {bracket.map((round) => (
                  <View key={round.name} className="gap-2">
                    <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                      {round.name}
                    </Text>
                    <View className="gap-2">
                      {round.matches.map((match, index) => (
                        <View
                          key={match.id ?? `${round.name}-${index}`}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                        >
                          <Text className="text-white text-xs">
                            {match.teamA} <Text className="text-white/40">vs</Text> {match.teamB}
                          </Text>
                          <Text className="text-white/40 text-[10px]">
                            Ganador: {match.winner || 'Sin definir'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-white/60 text-sm">Sin resultados disponibles.</Text>
            )}
          </View>
        ) : null}
        <View className="flex-row justify-end">
          <Pressable onPress={onClose} className="rounded-full border border-white/15 px-4 py-2">
            <Text className="text-white text-xs font-semibold">Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </ModalContainer>
  );
}

function FriendlyEventModal({ visible, mode, initialValues, onClose, venues, sports, onSave }) {
  const [form, setForm] = useState(() => initialValues);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showVenuePicker, setShowVenuePicker] = useState(false);
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [timeInput, setTimeInput] = useState('');
  const [timeInputError, setTimeInputError] = useState('');
  const [team1Query, setTeam1Query] = useState('');
  const [team2Query, setTeam2Query] = useState('');
  const [team1Results, setTeam1Results] = useState([]);
  const [team2Results, setTeam2Results] = useState([]);
  const [team1Loading, setTeam1Loading] = useState(false);
  const [team2Loading, setTeam2Loading] = useState(false);
  const [team1Error, setTeam1Error] = useState('');
  const [team2Error, setTeam2Error] = useState('');
  const [showTeam1Dropdown, setShowTeam1Dropdown] = useState(false);
  const [showTeam2Dropdown, setShowTeam2Dropdown] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  const isEditLocked = mode === 'edit' && initialValues?.status?.toLowerCase() !== 'inactivo';
  const editable = !isEditLocked;
  const resultsEditable = true;

  useEffect(() => {
    setForm(initialValues);
  }, [initialValues]);

  useEffect(() => {
    if (!visible) return;
    setShowDatePicker(false);
    setShowTimePicker(false);
    setShowVenuePicker(false);
    setShowSportPicker(false);
    setTimeInput(initialValues?.time ?? '');
    setTimeInputError('');
    setTeam1Query(initialValues?.team1 ?? '');
    setTeam2Query(initialValues?.team2 ?? '');
    setTeam1Results([]);
    setTeam2Results([]);
    setTeam1Error('');
    setTeam2Error('');
    setShowTeam1Dropdown(false);
    setShowTeam2Dropdown(false);
    setSubmitError('');
  }, [visible, initialValues]);

  useEffect(() => {
    if (!showTeam1Dropdown) return;
    const trimmed = team1Query.trim();
    if (trimmed.length < 2) {
      setTeam1Results([]);
      setTeam1Loading(false);
      setTeam1Error('');
      return;
    }
    let isActive = true;
    setTeam1Loading(true);
    setTeam1Error('');
    const timeout = setTimeout(async () => {
      try {
        const results = await searchTeams(trimmed, { limit: 8 });
        if (isActive) {
          setTeam1Results(results);
        }
      } catch (error) {
        if (isActive) {
          setTeam1Error(error?.message || 'No se pudieron buscar equipos.');
        }
      } finally {
        if (isActive) {
          setTeam1Loading(false);
        }
      }
    }, 300);
    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [showTeam1Dropdown, team1Query]);

  useEffect(() => {
    if (!showTeam2Dropdown) return;
    const trimmed = team2Query.trim();
    if (trimmed.length < 2) {
      setTeam2Results([]);
      setTeam2Loading(false);
      setTeam2Error('');
      return;
    }
    let isActive = true;
    setTeam2Loading(true);
    setTeam2Error('');
    const timeout = setTimeout(async () => {
      try {
        const results = await searchTeams(trimmed, { limit: 8 });
        if (isActive) {
          setTeam2Results(results);
        }
      } catch (error) {
        if (isActive) {
          setTeam2Error(error?.message || 'No se pudieron buscar equipos.');
        }
      } finally {
        if (isActive) {
          setTeam2Loading(false);
        }
      }
    }, 300);
    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [showTeam2Dropdown, team2Query]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const formatPrizeValue = (value) => formatCurrencyValue(value);

  const handleTimeInputChange = (value) => {
    const { formatted, isComplete, isValid } = formatTimeInput(value);
    setTimeInput(formatted);
    if (isComplete && !isValid) {
      setTimeInputError('Ingresá una hora válida (00-23 / 00-59).');
      return;
    }
    setTimeInputError('');
    if (isValid) {
      handleChange('time', formatted);
    }
  };

  const handleSubmit = async () => {
    if (saving) return;
    if (!isEditLocked) {
      if (!form.title?.trim()) {
        setSubmitError('Ingresá un título para el amistoso.');
        return;
      }
      if (!form.date) {
        setSubmitError('Seleccioná una fecha para el amistoso.');
        return;
      }
      if (!form.venue) {
        setSubmitError('Seleccioná una sede.');
        return;
      }
      if (!form.sport) {
        setSubmitError('Seleccioná un deporte.');
        return;
      }
      if (!form.team1Id || !form.team2Id) {
        setSubmitError('Seleccioná ambos equipos desde la búsqueda.');
        return;
      }
      if (String(form.team1Id) === String(form.team2Id)) {
        setSubmitError('Los equipos deben ser distintos.');
        return;
      }
    }
    setSaving(true);
    setSubmitError('');
    try {
      if (typeof onSave !== 'function') {
        throw new Error('No se encontró el manejador de guardado.');
      }
      await onSave({
        ...form,
        resultOnly: isEditLocked,
      });
      onClose();
    } catch (error) {
      setSubmitError(error?.message || 'No se pudo guardar el amistoso.');
    } finally {
      setSaving(false);
    }
  };

  const renderPickerModal = ({
    visible: pickerVisible,
    onClose,
    options,
    selectedValue,
    onSelect,
    title: pickerTitle,
    emptyText = 'No hay datos disponibles',
    headerContent,
  }) => {
    if (!pickerVisible) return null;
    return (
      <ModalContainer
        visible={pickerVisible}
        onRequestClose={onClose}
        containerClassName="w-full max-w-xl max-h-[480px]"
      >
        <Card className="w-full max-h-[480px]">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-white text-lg font-semibold">{pickerTitle}</Text>
            <Pressable onPress={onClose} className="h-9 w-9 items-center justify-center rounded-full bg-white/5">
              <Ionicons name="close" size={18} color="white" />
            </Pressable>
          </View>
          {headerContent ? <View className="mb-3">{headerContent}</View> : null}
          <ScrollView className="max-h-[320px]" contentContainerClassName="pb-2">
            {options.map((option) => {
              const value = option.value ?? option.id ?? option.key ?? option;
              const label = option.label ?? option.nombre ?? option.title ?? String(option);
              const active = String(selectedValue) === String(value);
              return (
                <Pressable
                  key={value}
                  onPress={() => {
                    onSelect(value, option);
                    onClose();
                  }}
                  className={`rounded-xl px-4 py-3 mb-2 border border-white/5 ${
                    active ? 'bg-white/10 border-mc-warn' : 'bg-white/5'
                  }`}
                >
                  <Text className="text-white text-base font-medium">{label}</Text>
                  {option.description ? (
                    <Text className="text-white/60 text-sm mt-1">{option.description}</Text>
                  ) : null}
                </Pressable>
              );
            })}
            {options.length === 0 ? (
              <Text className="text-white/60 text-sm text-center">{emptyText}</Text>
            ) : null}
          </ScrollView>
        </Card>
      </ModalContainer>
    );
  };

  const renderTeamResults = ({ query, results, loading, error, onSelect }) => (
    <View className="mt-2 rounded-2xl border border-white/10 bg-white/5">
      {loading ? (
        <View className="px-4 py-3 flex-row items-center gap-2">
          <Text className="text-white/70 text-sm">Buscando equipos...</Text>
        </View>
      ) : null}
      {error ? (
        <View className="px-4 py-3">
          <Text className="text-rose-200 text-sm">{error}</Text>
        </View>
      ) : null}
      {!loading && !error && query.trim().length < 2 ? (
        <View className="px-4 py-3">
          <Text className="text-white/60 text-sm">Escribí al menos 2 caracteres para buscar</Text>
        </View>
      ) : null}
      {!loading && !error && query.trim().length >= 2 && results.length === 0 ? (
        <View className="px-4 py-3">
          <Text className="text-white/60 text-sm">Sin resultados</Text>
        </View>
      ) : null}
      {results.map((team) => (
        <Pressable
          key={team.id ?? team.nombre}
          onPress={() => onSelect(team)}
          className="px-4 py-3 border-b border-white/5"
        >
          <Text className="text-white text-sm font-medium">{team.nombre}</Text>
          {team.descripcion ? (
            <Text className="text-white/60 text-xs mt-1">{team.descripcion}</Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );

  const venueLabel =
    venues.find((venue) => String(venue.cancha_id ?? venue.id) === String(form.venue))?.nombre ??
    venues.find((venue) => String(venue.cancha_id ?? venue.id) === String(form.venue))?.label ??
    form.venue;

  const sportLabel =
    sports.find((sport) => String(sport.id ?? sport.deporte_id) === String(form.sport))?.nombre ??
    sports.find((sport) => String(sport.id ?? sport.deporte_id) === String(form.sport))?.label ??
    form.sport;

  return (
    <ModalContainer
      visible={visible}
      onRequestClose={onClose}
      containerClassName="w-full max-w-3xl max-h-[90vh]"
    >
      <View className="gap-5 rounded-3xl border border-white/10 bg-mc-surface p-6 shadow-xl">
        <ModalHeader
          title={mode === 'edit' ? 'Editar amistoso' : 'Nuevo amistoso'}
          subtitle="Completá la información clave del amistoso."
          onClose={onClose}
        />
        {isEditLocked ? (
          <View className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3">
            <Text className="text-amber-100 text-xs">
              El evento está en curso o pausado. Solo podés editar el resultado.
            </Text>
          </View>
        ) : null}
        <View className="gap-4">
          <FormField
            label="Título"
            placeholder="Amistoso de pretemporada"
            value={form.title}
            onChangeText={(value) => handleChange('title', value)}
            editable={editable}
          />
          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                Fecha
              </Text>
              <Pressable
                onPress={() => editable && setShowDatePicker(true)}
                className={`min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 ${
                  editable ? '' : 'opacity-60'
                }`}
              >
                <Text className="text-white text-sm">
                  {EVENT_DATE_OPTIONS.find((option) => option.value === form.date)?.label ||
                    form.date ||
                    'Seleccioná una fecha'}
                </Text>
              </Pressable>
            </View>
            <View className="flex-1">
              <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                Hora
              </Text>
              <Pressable
                onPress={() => {
                  if (!editable) return;
                  setTimeInput(form.time ?? '');
                  setShowTimePicker(true);
                }}
                className={`min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 ${
                  editable ? '' : 'opacity-60'
                }`}
              >
                <Text className="text-white text-sm">
                  {form.time || 'Seleccioná un horario'}
                </Text>
              </Pressable>
            </View>
          </View>
          <View className="gap-2">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Sede
            </Text>
            <Pressable
              onPress={() => editable && setShowVenuePicker(true)}
              className={`min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 ${
                editable ? '' : 'opacity-60'
              }`}
            >
              <Text className="text-white text-sm">
                {venueLabel || 'Seleccioná una sede'}
              </Text>
            </Pressable>
          </View>
          <View className="gap-2">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Deporte
            </Text>
            <Pressable
              onPress={() => editable && setShowSportPicker(true)}
              className={`min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 ${
                editable ? '' : 'opacity-60'
              }`}
            >
              <Text className="text-white text-sm">
                {sportLabel || 'Seleccioná un deporte'}
              </Text>
            </Pressable>
          </View>
          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                Equipo 1
              </Text>
              <TextInput
                className={FORM_FIELD_CLASSNAME}
                placeholder="Local"
                placeholderTextColor="#94A3B8"
                value={team1Query}
                onChangeText={(value) => {
                  setTeam1Query(value);
                  handleChange('team1', value);
                  handleChange('team1Id', '');
                }}
                editable={editable}
                onFocus={() => setShowTeam1Dropdown(true)}
                onBlur={() => {
                  setTimeout(() => setShowTeam1Dropdown(false), 150);
                }}
              />
              {showTeam1Dropdown
                ? renderTeamResults({
                  query: team1Query,
                  results: team1Results,
                  loading: team1Loading,
                  error: team1Error,
                  onSelect: (team) => {
                    handleChange('team1', team.nombre);
                    handleChange('team1Id', team.id);
                    setTeam1Query(team.nombre);
                    setShowTeam1Dropdown(false);
                  },
                })
                : null}
            </View>
            <View className="flex-1">
              <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                Equipo 2
              </Text>
              <TextInput
                className={FORM_FIELD_CLASSNAME}
                placeholder="Visitante"
                placeholderTextColor="#94A3B8"
                value={team2Query}
                onChangeText={(value) => {
                  setTeam2Query(value);
                  handleChange('team2', value);
                  handleChange('team2Id', '');
                }}
                editable={editable}
                onFocus={() => setShowTeam2Dropdown(true)}
                onBlur={() => {
                  setTimeout(() => setShowTeam2Dropdown(false), 150);
                }}
              />
              {showTeam2Dropdown
                ? renderTeamResults({
                  query: team2Query,
                  results: team2Results,
                  loading: team2Loading,
                  error: team2Error,
                  onSelect: (team) => {
                    handleChange('team2', team.nombre);
                    handleChange('team2Id', team.id);
                    setTeam2Query(team.nombre);
                    setShowTeam2Dropdown(false);
                  },
                })
                : null}
            </View>
          </View>
          <View className="gap-2">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Premio
            </Text>
            <TextInput
              className={FORM_FIELD_CLASSNAME}
              placeholder="$ 0"
              placeholderTextColor="#94A3B8"
              value={formatPrizeValue(form.prize)}
              onChangeText={(value) => handleChange('prize', value.replace(/\D/g, ''))}
              editable={editable}
              keyboardType="numeric"
            />
          </View>
          <View className="gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <SectionTitle
              title="Resultado del amistoso"
              subtitle="Definí el marcador final y seleccioná el ganador."
            />
            <View className="flex-row gap-4">
              <View className="flex-1 gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
                <Text className="text-white text-xs font-semibold uppercase tracking-wide">
                  {form.team1 || 'Equipo 1'}
                </Text>
                <TextInput
                  className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-white"
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  value={form.team1Score}
                  onChangeText={(value) => handleChange('team1Score', value.replace(/[^0-9]/g, ''))}
                  editable={resultsEditable}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1 gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
                <Text className="text-white text-xs font-semibold uppercase tracking-wide">
                  {form.team2 || 'Equipo 2'}
                </Text>
                <TextInput
                  className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-white"
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  value={form.team2Score}
                  onChangeText={(value) => handleChange('team2Score', value.replace(/[^0-9]/g, ''))}
                  editable={resultsEditable}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View className="gap-2">
              <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                Ganador
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {[form.team1 || 'Equipo 1', form.team2 || 'Equipo 2', 'Empate'].map((option) => (
                  <OptionPill
                    key={option}
                    label={option}
                    active={form.winner === option}
                    onPress={() => handleChange('winner', option)}
                    disabled={!resultsEditable}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>
        <View className="flex-row justify-end gap-3 pt-2">
          <Pressable onPress={onClose} className="rounded-full border border-white/15 px-4 py-2">
            <Text className="text-white text-xs font-semibold">Cancelar</Text>
          </Pressable>
          <Pressable
            disabled={saving}
            onPress={handleSubmit}
            className={`rounded-full px-4 py-2 ${
              !saving ? 'bg-emerald-500/80' : 'bg-white/10'
            }`}
          >
            <Text className="text-white text-xs font-semibold">
              {saving ? 'Guardando...' : mode === 'edit' ? 'Guardar cambios' : 'Crear amistoso'}
            </Text>
          </Pressable>
        </View>
        {submitError ? (
          <Text className="text-rose-200 text-xs">{submitError}</Text>
        ) : null}
      </View>
      {renderPickerModal({
        visible: showDatePicker,
        onClose: () => setShowDatePicker(false),
        options: EVENT_DATE_OPTIONS,
        selectedValue: form.date,
        onSelect: (value) => handleChange('date', value),
        title: 'Seleccioná una fecha',
        emptyText: 'No hay fechas disponibles',
      })}
      {renderPickerModal({
        visible: showTimePicker,
        onClose: () => setShowTimePicker(false),
        options: EVENT_TIME_OPTIONS,
        selectedValue: form.time,
        onSelect: (value) => {
          handleChange('time', value);
          setTimeInput(value);
          setTimeInputError('');
        },
        title: 'Seleccioná un horario',
        headerContent: (
          <View className="gap-2">
            <Text className="text-white/70 text-xs">Ingresar manualmente</Text>
            <TextInput
              className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white"
              placeholder="HH:MM"
              placeholderTextColor="#94A3B8"
              value={timeInput}
              onChangeText={handleTimeInputChange}
              editable={editable}
              keyboardType="numeric"
            />
            {timeInputError ? (
              <Text className="text-rose-200 text-xs">{timeInputError}</Text>
            ) : null}
          </View>
        ),
        emptyText: 'No hay horarios disponibles',
      })}
      {renderPickerModal({
        visible: showVenuePicker,
        onClose: () => setShowVenuePicker(false),
        options: venues.map((venue) => ({
          value: venue.cancha_id ?? venue.id,
          label: venue.nombre ?? venue.label ?? `Cancha #${venue.cancha_id ?? venue.id}`,
          description: venue.descripcion ?? venue.deporte?.nombre,
        })),
        selectedValue: form.venue,
        onSelect: (value) => handleChange('venue', value),
        title: 'Seleccioná una sede',
        emptyText: 'No encontramos sedes disponibles',
      })}
      {renderPickerModal({
        visible: showSportPicker,
        onClose: () => setShowSportPicker(false),
        options: sports.map((sport) => ({
          value: sport.id ?? sport.deporte_id,
          label: sport.nombre ?? sport.label ?? `Deporte #${sport.id ?? sport.deporte_id}`,
        })),
        selectedValue: form.sport,
        onSelect: (value) => handleChange('sport', value),
        title: 'Seleccioná un deporte',
        emptyText: 'No encontramos deportes disponibles',
      })}
    </ModalContainer>
  );
}

function TournamentEventModal({
  visible,
  mode,
  initialValues,
  onClose,
  onSave,
  availableVenues,
  sports,
}) {
  const [form, setForm] = useState(() => initialValues);
  const [selectedVenues, setSelectedVenues] = useState(() =>
    normalizeVenueIds(initialValues?.venues)
  );
  const [standings, setStandings] = useState(() => initialValues?.standings ?? []);
  const [imageAsset, setImageAsset] = useState(null);
  const [imageError, setImageError] = useState('');
  const [pickingImage, setPickingImage] = useState(false);
  const [datePicker, setDatePicker] = useState({ visible: false, field: null });
  const [dateError, setDateError] = useState('');

  const isEditLocked = mode === 'edit' && initialValues?.status?.toLowerCase() !== 'inactivo';
  const editable = !isEditLocked;
  const resultsEditable = true;

  useEffect(() => {
    setForm(initialValues);
    setSelectedVenues(normalizeVenueIds(initialValues?.venues));
    setStandings(initialValues?.standings ?? []);
    setImageAsset(null);
    setImageError('');
    setDatePicker({ visible: false, field: null });
    setDateError('');
  }, [initialValues]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpenDatePicker = (field) => {
    if (!editable) return;
    setDatePicker({ visible: true, field });
  };

  const handleDateChange = (event, selectedDate) => {
    if (!datePicker.field) return;
    if (event?.type === 'dismissed') {
      setDatePicker({ visible: false, field: null });
      return;
    }
    const nextDate = selectedDate ?? new Date();
    handleChange(datePicker.field, formatDateInput(nextDate));
    setDateError('');
    if (Platform.OS !== 'ios') {
      setDatePicker({ visible: false, field: null });
    }
  };

  const validateDateRange = () => {
    const start = parseDateInput(form?.startDate);
    const end = parseDateInput(form?.endDate);
    if (start && end && end < start) {
      setDateError('La fecha de fin debe ser posterior o igual a la fecha de inicio.');
      return false;
    }
    setDateError('');
    return true;
  };

  const toggleVenue = (venueId) => {
    if (!editable) return;
    const parsed = Number(venueId);
    if (!Number.isFinite(parsed)) return;
    setSelectedVenues((prev) => {
      const exists = prev.includes(parsed);
      if (exists) {
        return prev.filter((id) => id !== parsed);
      }
      if (prev.length >= 10) return prev;
      return [...prev, parsed];
    });
  };

  const handleUploadPdf = () => {
    if (!editable) return;
    const filename = `reglamento-${Date.now()}.pdf`;
    setForm((prev) => ({ ...prev, pdfName: filename }));
  };

  const handleTeamCount = (value) => {
    const normalized = value.replace(/[^0-9]/g, '');
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      handleChange('teams', '');
      return;
    }
    const clamped = Math.max(5, Math.min(40, parsed));
    handleChange('teams', String(clamped));
  };

  const handleStandingChange = (index, field, value) => {
    if (!resultsEditable) return;
    setStandings((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    );
  };

  const moveStanding = (index, direction) => {
    if (!resultsEditable) return;
    setStandings((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [row] = next.splice(index, 1);
      next.splice(targetIndex, 0, row);
      return next;
    });
  };

  const handlePickImage = async () => {
    if (!editable || pickingImage) return;
    setPickingImage(true);
    setImageError('');
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          setImageError('Necesitamos permisos para acceder a tu galería.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (asset) {
        setImageAsset(asset);
        setForm((prev) => ({ ...prev, imageUrl: asset.uri }));
      }
    } catch (error) {
      setImageError(error?.message || 'No pudimos seleccionar la imagen.');
    } finally {
      setPickingImage(false);
    }
  };

  const imagePreview = useMemo(() => {
    if (imageAsset?.uri) return imageAsset.uri;
    return form?.imageUrl ? resolveAssetUrl(form.imageUrl) : null;
  }, [imageAsset?.uri, form?.imageUrl]);

  const handleSubmit = async () => {
    if (typeof onSave !== 'function') {
      onClose();
      return;
    }
    if (!validateDateRange()) return;
    await onSave({
      ...form,
      standings,
      imageAsset,
      venues: selectedVenues,
    });
    onClose();
  };

  return (
    <ModalContainer visible={visible} onRequestClose={onClose} containerClassName="w-full max-w-4xl max-h-[90vh]">
      <View className="gap-5 rounded-3xl border border-white/10 bg-mc-surface p-6 shadow-xl">
        <ModalHeader
          title={mode === 'edit' ? 'Editar torneo/liga' : 'Nuevo torneo o liga'}
          subtitle="Definí estructura, sedes y reglamento del torneo."
          onClose={onClose}
        />
        {isEditLocked ? (
          <View className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3">
            <Text className="text-amber-100 text-xs">
              El evento está en curso o pausado. Solo podés editar el resultado.
            </Text>
          </View>
        ) : null}
        <View className="gap-4">
          <FormField
            label="Nombre"
            placeholder="Liga Primavera 2024"
            value={form.name}
            onChangeText={(value) => handleChange('name', value)}
            editable={editable}
          />
          <View className="gap-2">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Imagen del evento
            </Text>
            <View className="flex-row items-center gap-3">
              <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                {imagePreview ? (
                  <Image source={{ uri: imagePreview }} className="h-full w-full" resizeMode="cover" />
                ) : (
                  <Ionicons name="image-outline" size={24} color="#94A3B8" />
                )}
              </View>
              <View className="flex-1 gap-2">
                <Pressable
                  onPress={handlePickImage}
                  disabled={!editable || pickingImage}
                  className={`rounded-full px-4 py-2 ${
                    editable && !pickingImage ? 'bg-sky-500/70' : 'bg-white/10'
                  }`}
                >
                  <Text className="text-white text-xs font-semibold">
                    {pickingImage ? 'Abriendo...' : 'Seleccionar imagen'}
                  </Text>
                </Pressable>
                {imageError ? <Text className="text-rose-200 text-xs">{imageError}</Text> : null}
              </View>
            </View>
          </View>
          <View className="flex-row gap-4">
            <View className="flex-1">
              <View className="gap-2">
                <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                  Fecha inicio
                </Text>
                {Platform.OS === 'web' ? (
                  <WebDateInput
                    value={form.startDate}
                    onChange={(value) => {
                      handleChange('startDate', value);
                      setDateError('');
                    }}
                    placeholder="YYYY-MM-DD"
                    className={FORM_FIELD_CLASSNAME}
                    disabled={!editable}
                  />
                ) : (
                  <Pressable
                    onPress={() => handleOpenDatePicker('startDate')}
                    disabled={!editable}
                    className={`${FORM_FIELD_CLASSNAME} flex-row items-center justify-between ${
                      !editable ? 'opacity-70' : ''
                    }`}
                  >
                    <Text className={form.startDate ? 'text-white' : 'text-white/50'}>
                      {form.startDate || 'Fecha inicio'}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="#E2E8F0" />
                  </Pressable>
                )}
              </View>
            </View>
            <View className="flex-1">
              <View className="gap-2">
                <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                  Fecha fin
                </Text>
                {Platform.OS === 'web' ? (
                  <WebDateInput
                    value={form.endDate}
                    onChange={(value) => {
                      handleChange('endDate', value);
                      setDateError('');
                    }}
                    placeholder="YYYY-MM-DD"
                    className={FORM_FIELD_CLASSNAME}
                    disabled={!editable}
                  />
                ) : (
                  <Pressable
                    onPress={() => handleOpenDatePicker('endDate')}
                    disabled={!editable}
                    className={`${FORM_FIELD_CLASSNAME} flex-row items-center justify-between ${
                      !editable ? 'opacity-70' : ''
                    }`}
                  >
                    <Text className={form.endDate ? 'text-white' : 'text-white/50'}>
                      {form.endDate || 'Fecha fin'}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="#E2E8F0" />
                  </Pressable>
                )}
              </View>
            </View>
          </View>
          {dateError ? <Text className="text-rose-200 text-xs">{dateError}</Text> : null}
          <View className="gap-2">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Zona
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {ZONE_OPTIONS.map((option) => (
                <OptionPill
                  key={option.value}
                  label={option.label}
                  active={normalizeZoneValue(form.zone) === option.value}
                  onPress={() => handleChange('zone', option.value)}
                  disabled={!editable}
                />
              ))}
            </View>
          </View>
          <View className="gap-3">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Sedes (máximo 10)
            </Text>
            {availableVenues?.length ? (
              <View className="gap-2">
                {availableVenues.map((venue) => {
                  const venueId = venue.cancha_id ?? venue.id;
                  const selected = selectedVenues.includes(Number(venueId));
                  const isDisabled =
                    !editable || (!selected && selectedVenues.length >= 10);
                  return (
                    <Pressable
                      key={`venue-${venueId}`}
                      onPress={() => toggleVenue(venueId)}
                      disabled={isDisabled}
                      className={`flex-row items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 ${
                        isDisabled ? 'opacity-60' : ''
                      }`}
                    >
                      <Ionicons
                        name={selected ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={selected ? '#34D399' : '#94A3B8'}
                      />
                      <View className="flex-1">
                        <Text className="text-white text-xs">
                          {venue.nombre ?? venue.label ?? `Cancha #${venueId}`}
                        </Text>
                        {venue?.deporte?.nombre ? (
                          <Text className="text-white/40 text-[10px]">
                            {venue.deporte.nombre}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text className="text-white/40 text-xs">Sin sedes disponibles.</Text>
            )}
            {selectedVenues.length >= 10 ? (
              <Text className="text-amber-100 text-xs">
                Llegaste al máximo de sedes seleccionadas.
              </Text>
            ) : null}
          </View>
          <View className="flex-row gap-4">
            <View className="flex-1">
              <FormField
                label="Cantidad de equipos"
                placeholder="5-40"
                value={form.teams}
                onChangeText={handleTeamCount}
                editable={editable}
                keyboardType="numeric"
              />
              <Text className="text-white/40 text-xs mt-1">Min 5 · Max 40</Text>
            </View>
          </View>
          <View className="gap-2">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Deporte
            </Text>
            {sports?.length ? (
              <View className="flex-row flex-wrap gap-2">
                {sports.map((sport) => {
                  const sportId = sport.id ?? sport.deporte_id;
                  return (
                    <OptionPill
                      key={`sport-${sportId}`}
                      label={
                        sport.nombre ??
                        sport.label ??
                        `Deporte #${sportId ?? ''}`
                      }
                      active={String(form.sport) === String(sportId)}
                      onPress={() =>
                        handleChange(
                          'sport',
                          normalizeNumberValue(sportId) ?? sportId
                        )
                      }
                      disabled={!editable}
                    />
                  );
                })}
              </View>
            ) : (
              <Text className="text-white/40 text-xs">Sin deportes disponibles.</Text>
            )}
          </View>
          <View className="gap-2">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">Formato</Text>
            <View className="flex-row gap-2">
              <OptionPill
                label="Ida"
                active={form.round === 'ida'}
                onPress={() => handleChange('round', 'ida')}
                disabled={!editable}
              />
              <OptionPill
                label="Ida y vuelta"
                active={form.round === 'ida-vuelta'}
                onPress={() => handleChange('round', 'ida-vuelta')}
                disabled={!editable}
              />
            </View>
          </View>
          <FormField
            label="Premios"
            placeholder="Trofeos, premios en efectivo"
            value={form.prizes}
            onChangeText={(value) => handleChange('prizes', value)}
            editable={editable}
          />
          <View className="flex-row gap-4">
            <View className="flex-1">
              <FormField
                label="Inscripción"
                placeholder="$ 12.000"
                value={form.entry}
                onChangeText={(value) => handleChange('entry', value)}
                editable={editable}
              />
            </View>
            <View className="flex-1">
              <FormField
                label="Días de juego"
                placeholder="Sábados y domingos"
                value={form.days}
                onChangeText={(value) => handleChange('days', value)}
                editable={editable}
              />
            </View>
          </View>
          <View className="gap-3">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Reglamento (PDF)
            </Text>
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={handleUploadPdf}
                disabled={!editable}
                className={`rounded-full px-4 py-2 ${
                  editable ? 'bg-sky-500/70' : 'bg-white/10'
                }`}
              >
                <Text className="text-white text-xs font-semibold">Subir PDF</Text>
              </Pressable>
              <Text className="text-white/60 text-xs">
                {form.pdfName ? form.pdfName : 'Sin archivo cargado'}
              </Text>
            </View>
            <FormField
              label="URL del reglamento"
              placeholder="https://..."
              value={form.pdfUrl}
              onChangeText={(value) => handleChange('pdfUrl', value)}
              editable={editable}
            />
          </View>
          <View className="gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <SectionTitle
              title="Tabla de posiciones"
              subtitle="Actualizá puntos y reordená la tabla según resultados."
            />
            <View className="flex-row items-center justify-between border-b border-white/10 pb-2">
              <Text className="text-white/50 text-xs w-8">#</Text>
              <Text className="text-white/50 text-xs flex-1">Equipo</Text>
              <Text className="text-white/50 text-xs w-12 text-center">PJ</Text>
              <Text className="text-white/50 text-xs w-12 text-center">PTS</Text>
              <Text className="text-white/50 text-xs w-16 text-right">Orden</Text>
            </View>
            {standings.length === 0 ? (
              <Text className="text-white/40 text-xs">Sin posiciones cargadas.</Text>
            ) : (
              standings.map((row, index) => (
                <View
                  key={row.id ?? `${row.team}-${index}`}
                  className="flex-row items-center gap-3 border-b border-white/5 py-2"
                >
                  <Text className="text-white/60 text-xs w-8">{index + 1}</Text>
                  <TextInput
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white text-xs"
                    value={row.team}
                    onChangeText={(value) => handleStandingChange(index, 'team', value)}
                    editable={resultsEditable}
                  />
                  <TextInput
                    className="w-12 rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-center text-white text-xs"
                    value={String(row.played)}
                    onChangeText={(value) =>
                      handleStandingChange(index, 'played', value.replace(/[^0-9]/g, ''))
                    }
                    editable={resultsEditable}
                    keyboardType="numeric"
                  />
                  <TextInput
                    className="w-12 rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-center text-white text-xs"
                    value={String(row.points)}
                    onChangeText={(value) =>
                      handleStandingChange(index, 'points', value.replace(/[^0-9]/g, ''))
                    }
                    editable={resultsEditable}
                    keyboardType="numeric"
                  />
                  <View className="flex-row gap-1 w-16 justify-end">
                    <Pressable
                      onPress={() => moveStanding(index, -1)}
                      disabled={!resultsEditable || index === 0}
                      className={`h-7 w-7 items-center justify-center rounded-full ${
                        !resultsEditable || index === 0 ? 'bg-white/10' : 'bg-white/5'
                      }`}
                    >
                      <Ionicons name="chevron-up" size={14} color="#E2E8F0" />
                    </Pressable>
                    <Pressable
                      onPress={() => moveStanding(index, 1)}
                      disabled={!resultsEditable || index === standings.length - 1}
                      className={`h-7 w-7 items-center justify-center rounded-full ${
                        !resultsEditable || index === standings.length - 1 ? 'bg-white/10' : 'bg-white/5'
                      }`}
                    >
                      <Ionicons name="chevron-down" size={14} color="#E2E8F0" />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
        <View className="flex-row justify-end gap-3 pt-2">
          <Pressable onPress={onClose} className="rounded-full border border-white/15 px-4 py-2">
            <Text className="text-white text-xs font-semibold">Cancelar</Text>
          </Pressable>
          <Pressable
            disabled={!(editable || resultsEditable)}
            onPress={handleSubmit}
            className={`rounded-full px-4 py-2 ${
              editable || resultsEditable ? 'bg-emerald-500/80' : 'bg-white/10'
            }`}
          >
            <Text className="text-white text-xs font-semibold">
              {mode === 'edit' ? 'Guardar cambios' : 'Crear torneo'}
            </Text>
          </Pressable>
        </View>
      </View>
      {datePicker.visible && Platform.OS !== 'web' ? (
        <DateTimePicker
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
          value={parseDateInput(form[datePicker.field]) ?? new Date()}
          onChange={handleDateChange}
        />
      ) : null}
    </ModalContainer>
  );
}

function CupEventModal({
  visible,
  mode,
  initialValues,
  onClose,
  onSave,
  availableVenues,
  sports,
}) {
  const [form, setForm] = useState(() => initialValues);
  const [selectedVenues, setSelectedVenues] = useState(() =>
    normalizeVenueIds(initialValues?.venues)
  );
  const [bracket, setBracket] = useState(() => initialValues?.bracket ?? []);
  const [imageAsset, setImageAsset] = useState(null);
  const [imageError, setImageError] = useState('');
  const [pickingImage, setPickingImage] = useState(false);
  const [datePicker, setDatePicker] = useState({ visible: false, field: null });
  const [dateError, setDateError] = useState('');

  const isEditLocked = mode === 'edit' && initialValues?.status?.toLowerCase() !== 'inactivo';
  const editable = !isEditLocked;
  const resultsEditable = true;

  useEffect(() => {
    setForm(initialValues);
    setSelectedVenues(normalizeVenueIds(initialValues?.venues));
    setBracket(initialValues?.bracket ?? []);
    setImageAsset(null);
    setImageError('');
    setDatePicker({ visible: false, field: null });
    setDateError('');
  }, [initialValues]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpenDatePicker = (field) => {
    if (!editable) return;
    setDatePicker({ visible: true, field });
  };

  const handleDateChange = (event, selectedDate) => {
    if (!datePicker.field) return;
    if (event?.type === 'dismissed') {
      setDatePicker({ visible: false, field: null });
      return;
    }
    const nextDate = selectedDate ?? new Date();
    handleChange(datePicker.field, formatDateInput(nextDate));
    setDateError('');
    if (Platform.OS !== 'ios') {
      setDatePicker({ visible: false, field: null });
    }
  };

  const validateDateRange = () => {
    const start = parseDateInput(form?.startDate);
    const end = parseDateInput(form?.endDate);
    if (start && end && end < start) {
      setDateError('La fecha de fin debe ser posterior o igual a la fecha de inicio.');
      return false;
    }
    setDateError('');
    return true;
  };

  const toggleVenue = (venueId) => {
    if (!editable) return;
    const parsed = Number(venueId);
    if (!Number.isFinite(parsed)) return;
    setSelectedVenues((prev) => {
      const exists = prev.includes(parsed);
      if (exists) {
        return prev.filter((id) => id !== parsed);
      }
      if (prev.length >= 10) return prev;
      return [...prev, parsed];
    });
  };

  const handleUploadPdf = () => {
    if (!editable) return;
    const filename = `reglamento-${Date.now()}.pdf`;
    setForm((prev) => ({ ...prev, pdfName: filename }));
  };

  const handleSelectWinner = (roundIndex, matchIndex, team) => {
    if (!resultsEditable) return;
    setBracket((prev) => {
      const next = prev.map((round) => ({
        ...round,
        matches: round.matches.map((match) => ({ ...match })),
      }));
      const round = next[roundIndex];
      if (!round) return prev;
      const match = round.matches[matchIndex];
      if (!match) return prev;
      match.winner = team;
      if (next[roundIndex + 1]) {
        const nextRound = next[roundIndex + 1];
        const nextMatchIndex = Math.floor(matchIndex / 2);
        const slot = matchIndex % 2 === 0 ? 'teamA' : 'teamB';
        nextRound.matches[nextMatchIndex][slot] = team;
      }
      return next;
    });
  };

  const handlePickImage = async () => {
    if (!editable || pickingImage) return;
    setPickingImage(true);
    setImageError('');
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          setImageError('Necesitamos permisos para acceder a tu galería.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (asset) {
        setImageAsset(asset);
        setForm((prev) => ({ ...prev, imageUrl: asset.uri }));
      }
    } catch (error) {
      setImageError(error?.message || 'No pudimos seleccionar la imagen.');
    } finally {
      setPickingImage(false);
    }
  };

  const imagePreview = useMemo(() => {
    if (imageAsset?.uri) return imageAsset.uri;
    return form?.imageUrl ? resolveAssetUrl(form.imageUrl) : null;
  }, [imageAsset?.uri, form?.imageUrl]);

  const handleSubmit = async () => {
    if (typeof onSave !== 'function') {
      onClose();
      return;
    }
    if (!validateDateRange()) return;
    await onSave({
      ...form,
      bracket,
      imageAsset,
      venues: selectedVenues,
    });
    onClose();
  };

  return (
    <ModalContainer visible={visible} onRequestClose={onClose} containerClassName="w-full max-w-4xl max-h-[90vh]">
      <View className="gap-5 rounded-3xl border border-white/10 bg-mc-surface p-6 shadow-xl">
        <ModalHeader
          title={mode === 'edit' ? 'Editar copa' : 'Nueva copa'}
          subtitle="Configurá el cuadro y la logística de la copa."
          onClose={onClose}
        />
        {isEditLocked ? (
          <View className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3">
            <Text className="text-amber-100 text-xs">
              El evento está en curso o pausado. Solo podés editar el resultado.
            </Text>
          </View>
        ) : null}
        <View className="gap-4">
          <FormField
            label="Nombre"
            placeholder="Copa Club"
            value={form.name}
            onChangeText={(value) => handleChange('name', value)}
            editable={editable}
          />
          <View className="gap-2">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Imagen del evento
            </Text>
            <View className="flex-row items-center gap-3">
              <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                {imagePreview ? (
                  <Image source={{ uri: imagePreview }} className="h-full w-full" resizeMode="cover" />
                ) : (
                  <Ionicons name="image-outline" size={24} color="#94A3B8" />
                )}
              </View>
              <View className="flex-1 gap-2">
                <Pressable
                  onPress={handlePickImage}
                  disabled={!editable || pickingImage}
                  className={`rounded-full px-4 py-2 ${
                    editable && !pickingImage ? 'bg-sky-500/70' : 'bg-white/10'
                  }`}
                >
                  <Text className="text-white text-xs font-semibold">
                    {pickingImage ? 'Abriendo...' : 'Seleccionar imagen'}
                  </Text>
                </Pressable>
                {imageError ? <Text className="text-rose-200 text-xs">{imageError}</Text> : null}
              </View>
            </View>
          </View>
          <View className="flex-row gap-4">
            <View className="flex-1">
              <View className="gap-2">
                <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                  Fecha inicio
                </Text>
                {Platform.OS === 'web' ? (
                  <WebDateInput
                    value={form.startDate}
                    onChange={(value) => {
                      handleChange('startDate', value);
                      setDateError('');
                    }}
                    placeholder="YYYY-MM-DD"
                    className={FORM_FIELD_CLASSNAME}
                    disabled={!editable}
                  />
                ) : (
                  <Pressable
                    onPress={() => handleOpenDatePicker('startDate')}
                    disabled={!editable}
                    className={`${FORM_FIELD_CLASSNAME} flex-row items-center justify-between ${
                      !editable ? 'opacity-70' : ''
                    }`}
                  >
                    <Text className={form.startDate ? 'text-white' : 'text-white/50'}>
                      {form.startDate || 'Fecha inicio'}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="#E2E8F0" />
                  </Pressable>
                )}
              </View>
            </View>
            <View className="flex-1">
              <View className="gap-2">
                <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                  Fecha fin
                </Text>
                {Platform.OS === 'web' ? (
                  <WebDateInput
                    value={form.endDate}
                    onChange={(value) => {
                      handleChange('endDate', value);
                      setDateError('');
                    }}
                    placeholder="YYYY-MM-DD"
                    className={FORM_FIELD_CLASSNAME}
                    disabled={!editable}
                  />
                ) : (
                  <Pressable
                    onPress={() => handleOpenDatePicker('endDate')}
                    disabled={!editable}
                    className={`${FORM_FIELD_CLASSNAME} flex-row items-center justify-between ${
                      !editable ? 'opacity-70' : ''
                    }`}
                  >
                    <Text className={form.endDate ? 'text-white' : 'text-white/50'}>
                      {form.endDate || 'Fecha fin'}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color="#E2E8F0" />
                  </Pressable>
                )}
              </View>
            </View>
          </View>
          {dateError ? <Text className="text-rose-200 text-xs">{dateError}</Text> : null}
          <View className="gap-2">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Zona
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {ZONE_OPTIONS.map((option) => (
                <OptionPill
                  key={option.value}
                  label={option.label}
                  active={normalizeZoneValue(form.zone) === option.value}
                  onPress={() => handleChange('zone', option.value)}
                  disabled={!editable}
                />
              ))}
            </View>
          </View>
          <View className="gap-3">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Sedes (máximo 10)
            </Text>
            {availableVenues?.length ? (
              <View className="gap-2">
                {availableVenues.map((venue) => {
                  const venueId = venue.cancha_id ?? venue.id;
                  const selected = selectedVenues.includes(Number(venueId));
                  const isDisabled =
                    !editable || (!selected && selectedVenues.length >= 10);
                  return (
                    <Pressable
                      key={`venue-${venueId}`}
                      onPress={() => toggleVenue(venueId)}
                      disabled={isDisabled}
                      className={`flex-row items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 ${
                        isDisabled ? 'opacity-60' : ''
                      }`}
                    >
                      <Ionicons
                        name={selected ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={selected ? '#34D399' : '#94A3B8'}
                      />
                      <View className="flex-1">
                        <Text className="text-white text-xs">
                          {venue.nombre ?? venue.label ?? `Cancha #${venueId}`}
                        </Text>
                        {venue?.deporte?.nombre ? (
                          <Text className="text-white/40 text-[10px]">
                            {venue.deporte.nombre}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text className="text-white/40 text-xs">Sin sedes disponibles.</Text>
            )}
            {selectedVenues.length >= 10 ? (
              <Text className="text-amber-100 text-xs">
                Llegaste al máximo de sedes seleccionadas.
              </Text>
            ) : null}
          </View>
          <View className="gap-2">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Cantidad de equipos
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {[4, 8, 16, 32, 64].map((option) => (
                <OptionPill
                  key={option}
                  label={`${option}`}
                  active={Number(form.teams) === option}
                  onPress={() => handleChange('teams', String(option))}
                  disabled={!editable}
                />
              ))}
            </View>
          </View>
          <View className="flex-row gap-4">
            <View className="flex-1">
              <FormField
                label="Días de juego"
                placeholder="Fines de semana"
                value={form.days}
                onChangeText={(value) => handleChange('days', value)}
                editable={editable}
              />
            </View>
          </View>
          <View className="gap-2">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Deporte
            </Text>
            {sports?.length ? (
              <View className="flex-row flex-wrap gap-2">
                {sports.map((sport) => {
                  const sportId = sport.id ?? sport.deporte_id;
                  return (
                    <OptionPill
                      key={`sport-${sportId}`}
                      label={
                        sport.nombre ??
                        sport.label ??
                        `Deporte #${sportId ?? ''}`
                      }
                      active={String(form.sport) === String(sportId)}
                      onPress={() =>
                        handleChange(
                          'sport',
                          normalizeNumberValue(sportId) ?? sportId
                        )
                      }
                      disabled={!editable}
                    />
                  );
                })}
              </View>
            ) : (
              <Text className="text-white/40 text-xs">Sin deportes disponibles.</Text>
            )}
          </View>
          <FormField
            label="Premios"
            placeholder="Trofeo y medallas"
            value={form.prizes}
            onChangeText={(value) => handleChange('prizes', value)}
            editable={editable}
          />
          <FormField
            label="Inscripción"
            placeholder="$ 15.000"
            value={form.entry}
            onChangeText={(value) => handleChange('entry', value)}
            editable={editable}
          />
          <View className="gap-3">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Reglamento (PDF)
            </Text>
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={handleUploadPdf}
                disabled={!editable}
                className={`rounded-full px-4 py-2 ${
                  editable ? 'bg-sky-500/70' : 'bg-white/10'
                }`}
              >
                <Text className="text-white text-xs font-semibold">Subir PDF</Text>
              </Pressable>
              <Text className="text-white/60 text-xs">
                {form.pdfName ? form.pdfName : 'Sin archivo cargado'}
              </Text>
            </View>
            <FormField
              label="URL del reglamento"
              placeholder="https://..."
              value={form.pdfUrl}
              onChangeText={(value) => handleChange('pdfUrl', value)}
              editable={editable}
            />
          </View>
          <View className="gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <SectionTitle
              title="Fixture por llaves"
              subtitle="Seleccioná ganadores y avanzá de ronda."
            />
            <View className="flex-col gap-4 lg:flex-row">
              {bracket.map((round, roundIndex) => (
                <View key={round.name} className="flex-1 gap-3">
                  <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                    {round.name}
                  </Text>
                  <View className="gap-3">
                    {round.matches.map((match, matchIndex) => (
                      <View
                        key={match.id ?? `${round.name}-${matchIndex}`}
                        className="gap-2 rounded-2xl border border-white/10 bg-white/5 p-3"
                      >
                        {[match.teamA, match.teamB].map((team) => (
                            <Pressable
                              key={`${match.id}-${team}`}
                              onPress={() => handleSelectWinner(roundIndex, matchIndex, team)}
                              disabled={!resultsEditable}
                              className={`rounded-xl border px-3 py-2 ${
                                match.winner === team
                                  ? 'border-emerald-400/60 bg-emerald-500/10'
                                  : 'border-white/10 bg-white/5'
                            } ${!resultsEditable ? 'opacity-60' : ''}`}
                            >
                            <Text className="text-white text-xs font-semibold">{team}</Text>
                          </Pressable>
                        ))}
                        <Text className="text-white/40 text-[11px]">
                          Ganador: {match.winner || 'Sin definir'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
        <View className="flex-row justify-end gap-3 pt-2">
          <Pressable onPress={onClose} className="rounded-full border border-white/15 px-4 py-2">
            <Text className="text-white text-xs font-semibold">Cancelar</Text>
          </Pressable>
          <Pressable
            disabled={!(editable || resultsEditable)}
            onPress={handleSubmit}
            className={`rounded-full px-4 py-2 ${
              editable || resultsEditable ? 'bg-emerald-500/80' : 'bg-white/10'
            }`}
          >
            <Text className="text-white text-xs font-semibold">
              {mode === 'edit' ? 'Guardar cambios' : 'Crear copa'}
            </Text>
          </Pressable>
        </View>
      </View>
      {datePicker.visible && Platform.OS !== 'web' ? (
        <DateTimePicker
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
          value={parseDateInput(form[datePicker.field]) ?? new Date()}
          onChange={handleDateChange}
        />
      ) : null}
    </ModalContainer>
  );
}

export default function EventosScreen() {
  const { user } = useAuth();
  const [filter, setFilter] = useState('provincia');
  const [activeModal, setActiveModal] = useState(null);
  const [activeMode, setActiveMode] = useState('create');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedGlobalEvent, setSelectedGlobalEvent] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsStatus, setEventsStatus] = useState({ loading: false, error: null });
  const [globalEvents, setGlobalEvents] = useState([]);
  const [globalEventsStatus, setGlobalEventsStatus] = useState({ loading: false, error: null });
  const [globalEventDetailStatus, setGlobalEventDetailStatus] = useState({
    loading: false,
    error: null,
  });
  const [globalPage, setGlobalPage] = useState(1);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [venues, setVenues] = useState([]);
  const [sports, setSports] = useState([]);
  const pageSize = 10;
  const clubLevel = useMemo(() => {
    const parsed = Number(user?.nivel_id ?? 1);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }, [user?.nivel_id]);
  const hasProAccess = clubLevel >= 2;

  const filteredGlobalEvents = useMemo(() => {
    const normalizedQuery = globalSearchQuery.trim().toLowerCase();
    return [...globalEvents]
      .filter((event) => {
        const normalizedStatus = normalizeStatus(event?.status);
        const matchesQuery =
          !normalizedQuery ||
          String(event?.organizer ?? '').toLowerCase().includes(normalizedQuery) ||
          String(event?.title ?? '').toLowerCase().includes(normalizedQuery);
        return (
          event.scope === filter &&
          (normalizedStatus === 'activo' || event?.status === 'activo') &&
          matchesQuery
        );
      })
      .sort((a, b) => {
        const aDate = new Date(a?.startDate ?? a?.fecha_inicio ?? 0).getTime();
        const bDate = new Date(b?.startDate ?? b?.fecha_inicio ?? 0).getTime();
        return aDate - bDate;
      });
  }, [filter, globalEvents, globalSearchQuery]);

  const pagedGlobalEvents = useMemo(() => {
    const startIndex = (globalPage - 1) * pageSize;
    const endIndex = globalPage * pageSize;
    return filteredGlobalEvents.slice(startIndex, endIndex);
  }, [filteredGlobalEvents, globalPage, pageSize]);

  const totalGlobalPages = Math.max(1, Math.ceil(filteredGlobalEvents.length / pageSize));

  useEffect(() => {
    setGlobalPage(1);
  }, [filter, globalEvents.length, globalSearchQuery]);

  useEffect(() => {
    setGlobalPage((prev) => Math.min(prev, totalGlobalPages));
  }, [totalGlobalPages]);

  const { orderedEvents, finalizedEvents } = useMemo(() => {
    const sorted = [...events].sort((a, b) => {
      const aOrder = STATUS_ORDER[normalizeStatus(a.status)] ?? 0;
      const bOrder = STATUS_ORDER[normalizeStatus(b.status)] ?? 0;
      return aOrder - bOrder;
    });
    const finalizados = sorted.filter(
      (event) => normalizeStatus(event.status) === 'finalizado'
    );
    const activos = sorted.filter(
      (event) => normalizeStatus(event.status) !== 'finalizado'
    );
    return { orderedEvents: activos, finalizedEvents: finalizados };
  }, [events]);

  const lockedButtonProps = hasProAccess
    ? {
      badge: null,
      backgroundClassName: 'bg-emerald-400 hover:bg-emerald-400/80',
      className: '',
    }
    : {
      badge: ADV_BADGE,
      backgroundClassName: 'bg-mc-warn/25',
      className: 'border border-sky-300/70',
    };

  const handleOpenCreate = (type) => {
    setActiveMode('create');
    setSelectedEvent(null);
    setActiveModal(type);
  };

  const loadClubEvents = async () => {
    setEventsStatus({ loading: true, error: null });
    try {
      const data = await api.get('/eventos');
      const eventos = Array.isArray(data?.eventos) ? data.eventos : [];
      setEvents(eventos.map(mapClubEvent));
      setEventsStatus({ loading: false, error: null });
    } catch (error) {
      setEvents([]);
      setEventsStatus({
        loading: false,
        error: error?.message || 'No se pudieron cargar los eventos.',
      });
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadEvents = async () => {
      if (!isMounted) return;
      await loadClubEvents();
    };

    loadEvents();

    const loadGlobalEvents = async () => {
      if (!user?.clubId) {
        setGlobalEvents([]);
        return;
      }
      setGlobalEventsStatus({ loading: true, error: null });
      try {
        const data = await api.get(`/eventos/globales?club_id=${user.clubId}`);
        const eventos = Array.isArray(data?.eventos) ? data.eventos : [];
        if (isMounted) {
          setGlobalEvents(eventos.map(mapGlobalEvent));
        }
      } catch (error) {
        if (isMounted) {
          setGlobalEventsStatus({
            loading: false,
            error: error?.message || 'No se pudieron cargar los eventos globales.',
          });
        }
        return;
      }
      if (isMounted) {
        setGlobalEventsStatus({ loading: false, error: null });
      }
    };
    loadGlobalEvents();
    return () => {
      isMounted = false;
    };
  }, [user?.clubId]);

  useEffect(() => {
    let isMounted = true;
    const loadVenues = async () => {
      try {
        const data = await fetchClubCourts();
        const filtered = data.filter((court) => {
          const status = String(court?.estado ?? court?.status ?? '').toLowerCase();
          if (!status) return true;
          return ['disponible', 'activa', 'activo', 'available'].includes(status);
        });
        if (isMounted) {
          setVenues(filtered);
        }
      } catch (error) {
        if (isMounted) {
          setVenues([]);
        }
      }
    };
    loadVenues();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadSports = async () => {
      try {
        const data = await fetchSports();
        if (isMounted) {
          setSports(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (isMounted) {
          setSports([]);
        }
      }
    };
    loadSports();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenEdit = (event) => {
    setActiveMode('edit');
    setSelectedEvent(event);
    setActiveModal(event.type);
    const loadEventDetails = async () => {
      try {
        const data = await api.get(`/eventos/${event.id}`);
        if (data?.evento) {
          const baseEvent = mapClubEvent(data.evento);
          if (event.type === 'amistoso') {
            const friendlyTeams = resolveFriendlyTeams(data.evento);
            const matchResult = buildMatchResult(data.evento);
            const winnerLabel = matchResult?.winnerId
              ? resolveEquipoName(
                Array.isArray(data.evento?.equipos) ? data.evento.equipos : [],
                matchResult.winnerId
              )
              : '';
            setSelectedEvent({
              ...baseEvent,
              ...friendlyTeams,
              team1Score:
                matchResult?.team1Score !== null && matchResult?.team1Score !== undefined
                  ? String(matchResult.team1Score)
                  : '',
              team2Score:
                matchResult?.team2Score !== null && matchResult?.team2Score !== undefined
                  ? String(matchResult.team2Score)
                  : '',
              winner: winnerLabel,
              matchId: matchResult?.matchId ?? null,
            });
            return;
          }
          setSelectedEvent((prev) => ({ ...prev, ...baseEvent }));
        }
      } catch (error) {
        console.error(error);
      }
    };
    loadEventDetails();
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setSelectedEvent(null);
  };

  const handleCloseGlobalEventModal = () => {
    setSelectedGlobalEvent(null);
    setGlobalEventDetailStatus({ loading: false, error: null });
  };

  const handleOpenGlobalEvent = async (event) => {
    if (!event?.id) return;
    setSelectedGlobalEvent(event);
    setGlobalEventDetailStatus({ loading: true, error: null });
    try {
      const detailType = resolveEventDetailType(event?.type);
      const endpoint = resolveEventDetailsEndpoint(event);
      const data = await api.get(endpoint);
      if (data?.evento) {
        const isGlobal = Boolean(event?.isGlobal) || Boolean(event?.scope);
        const mappedEvent = isGlobal ? mapGlobalEvent(data.evento) : mapClubEvent(data.evento);
        const detailedEvent = {
          ...mappedEvent,
          matchResult: detailType === 'amistoso' ? buildMatchResult(data.evento) : null,
          standings: detailType === 'torneo' ? buildStandings(data.evento) : [],
          bracket: detailType === 'copa' ? buildBracket(data.evento) : [],
        };
        setSelectedGlobalEvent((prev) => {
          if (!prev || prev.id !== event.id) return prev;
          return { ...prev, ...detailedEvent };
        });
      }
      setGlobalEventDetailStatus({ loading: false, error: null });
    } catch (error) {
      setGlobalEventDetailStatus({
        loading: false,
        error: error?.message || 'No se pudieron cargar los detalles del evento.',
      });
    }
  };

  const updateEventStatus = (eventoId, estado) => {
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventoId ? { ...event, status: estado ?? event.status } : event
      )
    );
  };

  const handleStartEvent = async (event) => {
    try {
      const data = await api.post(`/eventos/${event.id}/iniciar`);
      updateEventStatus(event.id, data?.evento?.estado ?? 'activo');
    } catch (error) {
      console.error(error);
    }
  };

  const handlePauseEvent = async (event) => {
    try {
      const data = await api.post(`/eventos/${event.id}/pausar`);
      updateEventStatus(event.id, data?.evento?.estado ?? 'pausado');
    } catch (error) {
      console.error(error);
    }
  };

  const friendlyInitialValues = useMemo(
    () => ({
      title: selectedEvent?.title ?? '',
      date: selectedEvent?.startDate ?? '',
      time: selectedEvent?.time ?? '',
      venue: selectedEvent?.venue ?? '',
      sport: selectedEvent?.sport ?? '',
      team1: selectedEvent?.team1 ?? '',
      team1Id: selectedEvent?.team1Id ?? '',
      team2: selectedEvent?.team2 ?? '',
      team2Id: selectedEvent?.team2Id ?? '',
      team1Score:
        selectedEvent?.team1Score !== undefined && selectedEvent?.team1Score !== null
          ? String(selectedEvent.team1Score)
          : '',
      team2Score:
        selectedEvent?.team2Score !== undefined && selectedEvent?.team2Score !== null
          ? String(selectedEvent.team2Score)
          : '',
      winner: selectedEvent?.winner ?? '',
      prize: selectedEvent?.prize ?? '',
      status: selectedEvent?.status ?? '',
      imageUrl: selectedEvent?.imageUrl ?? '',
    }),
    [selectedEvent]
  );

  const tournamentInitialValues = useMemo(
    () => ({
      name: selectedEvent?.title ?? '',
      dates:
        selectedEvent?.dates ??
        (() => {
          const range = formatEventRange(
            selectedEvent?.startDate ?? selectedEvent?.raw?.fecha_inicio,
            selectedEvent?.endDate ?? selectedEvent?.raw?.fecha_fin
          );
          return range === 'Sin fecha' ? '' : range;
        })(),
      startDate: normalizeDateInputValue(
        selectedEvent?.startDate ?? selectedEvent?.raw?.fecha_inicio ?? ''
      ),
      endDate: normalizeDateInputValue(
        selectedEvent?.endDate ?? selectedEvent?.raw?.fecha_fin ?? ''
      ),
      zone: normalizeZoneValue(selectedEvent?.zone ?? selectedEvent?.raw?.zona ?? ''),
      teams: selectedEvent?.teams ?? selectedEvent?.raw?.limite_equipos ?? '',
      sport: selectedEvent?.sport ?? selectedEvent?.raw?.deporte_id ?? '',
      round: selectedEvent?.round ?? 'ida',
      prizes: selectedEvent?.prizes ?? selectedEvent?.raw?.premio_1 ?? '',
      entry: selectedEvent?.entry ?? selectedEvent?.raw?.valor_inscripcion ?? '',
      days: selectedEvent?.days ?? '',
      pdfName: selectedEvent?.pdfName ?? '',
      pdfUrl: selectedEvent?.pdfUrl ?? selectedEvent?.raw?.reglamento_url ?? '',
      venues: normalizeVenueIds(selectedEvent?.venues ?? selectedEvent?.raw?.sedes ?? []),
      standings: selectedEvent?.standings ?? DEFAULT_STANDINGS,
      status: selectedEvent?.status ?? '',
      imageUrl: selectedEvent?.imageUrl ?? '',
    }),
    [selectedEvent]
  );

  const cupInitialValues = useMemo(
    () => ({
      name: selectedEvent?.title ?? '',
      dates:
        selectedEvent?.dates ??
        (() => {
          const range = formatEventRange(
            selectedEvent?.startDate ?? selectedEvent?.raw?.fecha_inicio,
            selectedEvent?.endDate ?? selectedEvent?.raw?.fecha_fin
          );
          return range === 'Sin fecha' ? '' : range;
        })(),
      startDate: normalizeDateInputValue(
        selectedEvent?.startDate ?? selectedEvent?.raw?.fecha_inicio ?? ''
      ),
      endDate: normalizeDateInputValue(
        selectedEvent?.endDate ?? selectedEvent?.raw?.fecha_fin ?? ''
      ),
      zone: normalizeZoneValue(selectedEvent?.zone ?? selectedEvent?.raw?.zona ?? ''),
      teams: selectedEvent?.teams ?? selectedEvent?.raw?.limite_equipos ?? '',
      sport: selectedEvent?.sport ?? selectedEvent?.raw?.deporte_id ?? '',
      prizes: selectedEvent?.prizes ?? selectedEvent?.raw?.premio_1 ?? '',
      entry: selectedEvent?.entry ?? selectedEvent?.raw?.valor_inscripcion ?? '',
      days: selectedEvent?.days ?? '',
      pdfName: selectedEvent?.pdfName ?? '',
      pdfUrl: selectedEvent?.pdfUrl ?? selectedEvent?.raw?.reglamento_url ?? '',
      venues: normalizeVenueIds(selectedEvent?.venues ?? selectedEvent?.raw?.sedes ?? []),
      bracket: selectedEvent?.bracket ?? DEFAULT_BRACKET,
      status: selectedEvent?.status ?? '',
      imageUrl: selectedEvent?.imageUrl ?? '',
    }),
    [selectedEvent]
  );

  const resolveVenueName = (venueValue) => {
    if (!venueValue) return '';
    const match = venues.find(
      (venue) => String(venue.cancha_id ?? venue.id) === String(venueValue)
    );
    return match?.nombre ?? match?.label ?? String(venueValue);
  };

  const resolveClubProvinceId = () => {
    const candidates = [
      user?.club?.provincia_id,
      user?.club?.provincia?.id,
      user?.provincia_id,
    ];
    for (const candidate of candidates) {
      const parsed = normalizeNumberValue(candidate);
      if (parsed && parsed > 0) return parsed;
    }
    return null;
  };

  const resolveSportId = (value, fallbackEvent) => {
    const parsed = normalizeNumberValue(value);
    if (parsed && parsed > 0) return parsed;
    const fallback = normalizeNumberValue(fallbackEvent?.raw?.deporte_id ?? fallbackEvent?.sport);
    if (fallback && fallback > 0) return fallback;
    return null;
  };

  const buildTournamentPayload = (type, formValues, fallbackEvent) => {
    const fallbackStart = fallbackEvent?.startDate ?? fallbackEvent?.raw?.fecha_inicio ?? null;
    const fallbackEnd = fallbackEvent?.endDate ?? fallbackEvent?.raw?.fecha_fin ?? null;
    const { startDate, endDate } = resolveDateRangeInput(
      formValues,
      fallbackStart,
      fallbackEnd
    );
    const zona = normalizeZoneValue(
      formValues?.zone ?? fallbackEvent?.raw?.zona ?? 'regional'
    );
    const provinciaId = zona === 'regional' ? resolveClubProvinceId() : null;
    const payload = {
      nombre: formValues?.name?.trim() || fallbackEvent?.title || '',
      tipo: type,
      fecha_inicio: startDate,
      fecha_fin: endDate,
      zona,
      provincia_id: provinciaId,
      deporte_id: resolveSportId(formValues?.sport, fallbackEvent),
      limite_equipos: normalizeNumberValue(formValues?.teams),
      valor_inscripcion: parseCurrencyInput(formValues?.entry),
      premio_1: parseCurrencyInput(formValues?.prizes),
      reglamento_url: formValues?.pdfUrl?.trim() || null,
    };
    if (!payload.fecha_inicio) delete payload.fecha_inicio;
    if (!payload.fecha_fin) delete payload.fecha_fin;
    if (!payload.deporte_id) delete payload.deporte_id;
    if (payload.limite_equipos == null) delete payload.limite_equipos;
    if (payload.valor_inscripcion == null) delete payload.valor_inscripcion;
    if (payload.premio_1 == null) delete payload.premio_1;
    if (!payload.reglamento_url) delete payload.reglamento_url;
    return payload;
  };

  const saveEventVenues = async (eventId, venuesSelection) => {
    if (!eventId) return;
    const sedes = normalizeVenueIds(venuesSelection);
    await api.put(`/eventos/${eventId}/sedes`, { sedes });
  };

  const upsertFriendlyMatch = async (eventId, formValues, matchId) => {
    if (!eventId) return;
    const team1Score = normalizeScoreValue(formValues.team1Score);
    const team2Score = normalizeScoreValue(formValues.team2Score);
    const team1Id = formValues.team1Id ? Number(formValues.team1Id) : null;
    const team2Id = formValues.team2Id ? Number(formValues.team2Id) : null;
    const payload = {
      fase: 'amistoso',
      equipo_local_id: team1Id,
      equipo_visitante_id: team2Id,
      marcador_local: team1Score,
      marcador_visitante: team2Score,
      estado: team1Score !== null || team2Score !== null ? 'jugado' : 'pendiente',
    };

    if (matchId) {
      await api.put(`/eventos/${eventId}/partidos/${matchId}`, payload);
      return;
    }

    if (team1Id && team2Id && (team1Score !== null || team2Score !== null)) {
      await api.post(`/eventos/${eventId}/partidos`, payload);
    }
  };

  const handleSaveFriendly = async (formValues) => {
    try {
      const isResultOnly = formValues?.resultOnly;
      if (
        activeMode === 'edit' &&
        selectedEvent?.id &&
        selectedEvent?.status?.toLowerCase() !== 'inactivo' &&
        isResultOnly
      ) {
        await upsertFriendlyMatch(selectedEvent.id, formValues, selectedEvent?.matchId);
        setEvents((prev) =>
          prev.map((item) =>
            item.id === selectedEvent.id
              ? {
                ...item,
                team1Score: formValues.team1Score,
                team2Score: formValues.team2Score,
                winner: formValues.winner,
              }
              : item
          )
        );
        return;
      }
      const equipos =
        formValues.team1Id && formValues.team2Id
          ? [
            { equipo_id: formValues.team1Id, nombre_equipo: formValues.team1 },
            { equipo_id: formValues.team2Id, nombre_equipo: formValues.team2 },
          ]
          : [];
      const payload = {
        nombre: formValues.title.trim(),
        tipo: 'amistoso',
        fecha_inicio: formValues.date,
        hora_inicio: formValues.time || null,
        zona: 'regional',
        descripcion: resolveVenueName(formValues.venue),
        deporte_id: formValues.sport,
        limite_equipos: 2,
        premio_1: formValues.prize ? String(formValues.prize) : null,
        equipos,
      };

      if (activeMode === 'edit' && selectedEvent?.id) {
        const data = await api.put(`/eventos/${selectedEvent.id}`, payload);
        await upsertFriendlyMatch(selectedEvent.id, formValues, selectedEvent?.matchId);
        const updatedEvent = mapClubEvent(data?.evento);
        setEvents((prev) =>
          prev.map((item) => (item.id === selectedEvent.id ? updatedEvent : item))
        );
        return;
      }

      const data = await api.post('/eventos', payload);
      if (data?.evento) {
        const createdId = data.evento?.evento_id ?? data.evento?.id;
        await upsertFriendlyMatch(createdId, formValues, null);
        setEvents((prev) => [mapClubEvent(data.evento), ...prev]);
        return;
      }

      await loadClubEvents();
    } catch (error) {
      throw error;
    }
  };

  const handleSaveTournament = async (formValues) => {
    try {
      const payload = buildTournamentPayload('torneo', formValues, selectedEvent);
      if (activeMode === 'edit' && selectedEvent?.id) {
        const data = await api.put(`/eventos/${selectedEvent.id}`, payload);
        await saveEventVenues(selectedEvent.id, formValues?.venues);
        let uploadedImageUrl = null;
        if (formValues?.imageAsset) {
          uploadedImageUrl = await uploadEventImage(selectedEvent.id, formValues.imageAsset);
        }
        const updatedEvent = mapClubEvent(data?.evento ?? { ...payload, id: selectedEvent.id });
        setEvents((prev) =>
          prev.map((item) =>
            item.id === selectedEvent.id
              ? {
                ...updatedEvent,
                standings: formValues.standings ?? item.standings,
                venues: normalizeVenueIds(formValues?.venues),
                imageUrl:
                  uploadedImageUrl ??
                  formValues.imageUrl ??
                  updatedEvent.imageUrl ??
                  item.imageUrl,
              }
              : item
          )
        );
        return;
      }
      const data = await api.post('/eventos', payload);
      if (data?.evento) {
        const created = mapClubEvent(data.evento);
        const createdId = data.evento?.evento_id ?? data.evento?.id ?? created.id;
        await saveEventVenues(createdId, formValues?.venues);
        let uploadedImageUrl = null;
        if (formValues?.imageAsset && createdId) {
          uploadedImageUrl = await uploadEventImage(createdId, formValues.imageAsset);
        }
        setEvents((prev) => [
          {
            ...created,
            standings: formValues.standings ?? DEFAULT_STANDINGS,
            venues: normalizeVenueIds(formValues?.venues),
            imageUrl: uploadedImageUrl ?? formValues.imageUrl ?? created.imageUrl,
          },
          ...prev,
        ]);
        return;
      }
      await loadClubEvents();
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const handleSaveCup = async (formValues) => {
    try {
      const payload = buildTournamentPayload('copa', formValues, selectedEvent);
      if (activeMode === 'edit' && selectedEvent?.id) {
        const data = await api.put(`/eventos/${selectedEvent.id}`, payload);
        await saveEventVenues(selectedEvent.id, formValues?.venues);
        let uploadedImageUrl = null;
        if (formValues?.imageAsset) {
          uploadedImageUrl = await uploadEventImage(selectedEvent.id, formValues.imageAsset);
        }
        const updatedEvent = mapClubEvent(data?.evento ?? { ...payload, id: selectedEvent.id });
        setEvents((prev) =>
          prev.map((item) =>
            item.id === selectedEvent.id
              ? {
                ...updatedEvent,
                bracket: formValues.bracket ?? item.bracket,
                venues: normalizeVenueIds(formValues?.venues),
                imageUrl:
                  uploadedImageUrl ??
                  formValues.imageUrl ??
                  updatedEvent.imageUrl ??
                  item.imageUrl,
              }
              : item
          )
        );
        return;
      }
      const data = await api.post('/eventos', payload);
      if (data?.evento) {
        const created = mapClubEvent(data.evento);
        const createdId = data.evento?.evento_id ?? data.evento?.id ?? created.id;
        await saveEventVenues(createdId, formValues?.venues);
        let uploadedImageUrl = null;
        if (formValues?.imageAsset && createdId) {
          uploadedImageUrl = await uploadEventImage(createdId, formValues.imageAsset);
        }
        setEvents((prev) => [
          {
            ...created,
            bracket: formValues.bracket ?? DEFAULT_BRACKET,
            venues: normalizeVenueIds(formValues?.venues),
            imageUrl: uploadedImageUrl ?? formValues.imageUrl ?? created.imageUrl,
          },
          ...prev,
        ]);
        return;
      }
      await loadClubEvents();
    } catch (error) {
      console.error(error);
      throw error;
    }
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
              onPress={() => handleOpenCreate('amistoso')}
              icon="sparkles-outline"
              label="Crear Amistoso"
              backgroundClassName="bg-emerald-400 hover:bg-emerald-400/80"
            />
            <ActionButton
              onPress={() => handleOpenCreate('torneo')}
              disabled={!hasProAccess}
              icon="trophy-outline"
              label="Crear Torneo"
              badge={lockedButtonProps.badge}
              backgroundClassName={lockedButtonProps.backgroundClassName}
              className={lockedButtonProps.className}
            />
            <ActionButton
              onPress={() => handleOpenCreate('copa')}
              disabled={!hasProAccess}
              icon="flag-outline"
              label="Crear Copa"
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
              {eventsStatus.loading ? (
                <Text className="text-white/60 text-sm">Cargando eventos...</Text>
              ) : null}
              {eventsStatus.error ? (
                <Text className="text-rose-200 text-sm">{eventsStatus.error}</Text>
              ) : null}
              {!eventsStatus.loading &&
              !eventsStatus.error &&
              orderedEvents.length === 0 &&
              finalizedEvents.length === 0 ? (
                  <Text className="text-white/50 text-sm">No hay eventos registrados.</Text>
                ) : null}
              {orderedEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onPress={() => handleOpenEdit(event)}
                  onEdit={(pressEvent) => {
                    pressEvent?.stopPropagation?.();
                    handleOpenEdit(event);
                  }}
                  onStart={(pressEvent) => {
                    pressEvent?.stopPropagation?.();
                    handleStartEvent(event);
                  }}
                  onPause={(pressEvent) => {
                    pressEvent?.stopPropagation?.();
                    handlePauseEvent(event);
                  }}
                  onDelete={(pressEvent) => {
                    pressEvent?.stopPropagation?.();
                  }}
                />
              ))}
              {finalizedEvents.length > 0 ? (
                <View className="gap-3 pt-2">
                  <View className="flex-row items-center gap-3">
                    <View className="h-px flex-1 bg-white/10" />
                    <Text className="text-white/50 text-xs font-semibold uppercase tracking-wide">
                      Eventos finalizados
                    </Text>
                    <View className="h-px flex-1 bg-white/10" />
                  </View>
                </View>
              ) : null}
              {finalizedEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onPress={() => handleOpenEdit(event)}
                  onEdit={(pressEvent) => {
                    pressEvent?.stopPropagation?.();
                    handleOpenEdit(event);
                  }}
                  onStart={(pressEvent) => {
                    pressEvent?.stopPropagation?.();
                    handleStartEvent(event);
                  }}
                  onPause={(pressEvent) => {
                    pressEvent?.stopPropagation?.();
                    handlePauseEvent(event);
                  }}
                  onDelete={(pressEvent) => {
                    pressEvent?.stopPropagation?.();
                  }}
                />
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
                  label="Regionales"
                  active={filter === 'provincia'}
                  onPress={() => setFilter('provincia')}
                />
                <FilterPill
                  label="Nacionales"
                  active={filter === 'nacional'}
                  onPress={() => setFilter('nacional')}
                />
              </View>
            </View>
            <Text className="text-white/60">
              Explorá convocatorias oficiales y definí tu participación según región.
            </Text>
            <View className="flex-row gap-2">
              <TextInput
                value={globalSearchQuery}
                onChangeText={(value) => setGlobalSearchQuery(value)}
                placeholder="Buscar por Club organizador o nombre del Evento"
                placeholderTextColor="#94A3B8"
                className={`${FORM_FIELD_CLASSNAME} flex-1`}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setGlobalSearchQuery((prev) => prev.trim())}
                className="rounded-full border border-white/10 px-4 py-3"
              >
                <Ionicons name="search-outline" size={16} color="#F8FAFC" />
              </Pressable>
            </View>
            <View className="mt-4 gap-4">
              {globalEventsStatus.loading ? (
                <Text className="text-white/60 text-sm">Cargando eventos globales...</Text>
              ) : null}
              {globalEventsStatus.error ? (
                <Text className="text-rose-200 text-sm">{globalEventsStatus.error}</Text>
              ) : null}
              {!globalEventsStatus.loading && !globalEventsStatus.error && filteredGlobalEvents.length === 0 ? (
                <Text className="text-white/50 text-sm">
                  No hay eventos globales disponibles para este filtro.
                </Text>
              ) : null}
              {pagedGlobalEvents.map((event) => {
                const eventDate = formatEventRange(event.startDate, event.endDate);
                const priceLabel = formatCurrencyValue(event.price);
                const prizeLabel = formatCurrencyValue(event.prize);
                const normalizedType = String(event.type ?? '').trim().toLowerCase();
                const isTournamentOrCup = ['torneo', 'copa'].includes(normalizedType);
                const isFriendly = normalizedType === 'amistoso';
                const typeLabel = resolveEventTypeLabel(event.type);
                const badgeClassName = isTournamentOrCup
                  ? 'rounded-full border border-sky-400/50 bg-sky-500/20 px-2 py-[2px]'
                  : 'rounded-full border border-white/15 bg-white/10 px-2 py-[2px]';
                const badgeTextClassName = isTournamentOrCup
                  ? 'text-[10px] font-semibold text-sky-100'
                  : 'text-[10px] font-semibold text-white/70';
                const imageSource = isFriendly
                  ? FRIENDLY_DEFAULT_IMAGE
                  : { uri: resolveAssetUrl(event.imageUrl) };
                return (
                  <Pressable
                    key={event.id}
                    className={`rounded-2xl border ${
                      isTournamentOrCup ? 'border-sky-300/70' : 'border-white/10'
                    } bg-white/5 p-4`}
                    onPress={() => handleOpenGlobalEvent(event)}
                  >
                    <View className="flex-row gap-4">
                      <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5">
                        <Image source={imageSource} className="h-full w-full" resizeMode="cover" />
                      </View>
                      <View className="flex-1 gap-2">
                        <View className="flex-row items-start justify-between gap-2">
                          <Text className="flex-1 text-white font-semibold">{event.title}</Text>
                          {typeLabel ? (
                            <View className={badgeClassName}>
                              <Text className={badgeTextClassName}>{typeLabel}</Text>
                            </View>
                          ) : null}
                        </View>
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Text className="text-white/60 text-xs">{eventDate}</Text>
                          <Text className="text-white/50 text-xs">{event.organizer}</Text>
                        </View>
                        <View className="flex-row flex-wrap items-center gap-2">
                          {priceLabel ? (
                            <Text className="text-white/60 text-xs">
                              {priceLabel} inscripción
                            </Text>
                          ) : null}
                          {prizeLabel ? (
                            <Text className="text-white/50 text-xs">Premio {prizeLabel}</Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
              {filteredGlobalEvents.length > 0 ? (
                <View className="flex-row items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <Pressable
                    onPress={() => setGlobalPage((prev) => Math.max(1, prev - 1))}
                    disabled={globalPage === 1}
                    className={`rounded-full px-3 py-1 ${
                      globalPage === 1 ? 'bg-white/10' : 'bg-white/10 hover:bg-white/15'
                    }`}
                  >
                    <Text className="text-white text-xs font-semibold">Anterior</Text>
                  </Pressable>
                  <Text className="text-white/70 text-xs font-semibold">
                    Página {globalPage} de {totalGlobalPages}
                  </Text>
                  <Pressable
                    onPress={() => setGlobalPage((prev) => Math.min(totalGlobalPages, prev + 1))}
                    disabled={globalPage >= totalGlobalPages}
                    className={`rounded-full px-3 py-1 ${
                      globalPage >= totalGlobalPages
                        ? 'bg-white/10'
                        : 'bg-white/10 hover:bg-white/15'
                    }`}
                  >
                    <Text className="text-white text-xs font-semibold">Siguiente</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </Card>
        </View>
      </View>
      <FriendlyEventModal
        visible={activeModal === 'amistoso'}
        mode={activeMode}
        initialValues={friendlyInitialValues}
        onClose={handleCloseModal}
        venues={venues}
        sports={sports}
        onSave={handleSaveFriendly}
      />
      <TournamentEventModal
        visible={activeModal === 'torneo'}
        mode={activeMode}
        initialValues={tournamentInitialValues}
        onClose={handleCloseModal}
        onSave={handleSaveTournament}
        availableVenues={venues}
        sports={sports}
      />
      <CupEventModal
        visible={activeModal === 'copa'}
        mode={activeMode}
        initialValues={cupInitialValues}
        onClose={handleCloseModal}
        onSave={handleSaveCup}
        availableVenues={venues}
        sports={sports}
      />
      <GlobalEventModal
        event={selectedGlobalEvent}
        detailStatus={globalEventDetailStatus}
        onClose={handleCloseGlobalEventModal}
      />
    </ScrollView>
  );
}
