import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/Card';
import ReservationFormModal from './ReservationFormModal';
import {
  createClubReservation,
  deleteClubReservation,
  getReservationsPanel,
} from '../../lib/api';

const COURT_COLORS = [
  { bg: 'bg-emerald-500/20', border: 'border-emerald-400/40', text: 'text-emerald-200' },
  { bg: 'bg-sky-500/20', border: 'border-sky-400/40', text: 'text-sky-200' },
  { bg: 'bg-violet-500/20', border: 'border-violet-400/40', text: 'text-violet-200' },
  { bg: 'bg-orange-500/20', border: 'border-orange-400/40', text: 'text-orange-200' },
  { bg: 'bg-rose-500/20', border: 'border-rose-400/40', text: 'text-rose-200' },
];

const SLOT_MINUTES = 60;
const SLOT_HEIGHT = 68;

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateForApi(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateString(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDisplayDate(value) {
  const date = value instanceof Date ? value : parseDateString(value);
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch (err) {
    return formatDateForApi(date);
  }
}

function timeToMinutes(time) {
  if (!time) return null;
  const [hours, minutes] = String(time).split(':');
  const h = Number(hours);
  const m = Number(minutes);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function formatTime(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '$0';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '$0';
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch (err) {
    return `$${Math.round(amount)}`;
  }
}

function ensureTimeWithSeconds(value) {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  const parts = trimmed.split(':');
  const parsePart = (part) => {
    const numeric = Number(part);
    return Number.isFinite(numeric) ? numeric : null;
  };
  if (parts.length === 3) {
    const [hRaw, mRaw, sRaw] = parts;
    const h = parsePart(hRaw);
    const m = parsePart(mRaw);
    const s = parsePart(sRaw);
    if (h == null || m == null || s == null) {
      return trimmed;
    }
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  if (parts.length === 2) {
    const [hRaw, mRaw] = parts;
    const h = parsePart(hRaw);
    const m = parsePart(mRaw);
    if (h == null || m == null) {
      return trimmed;
    }
    return `${pad(h)}:${pad(m)}:00`;
  }
  return trimmed;
}

function normalizeReservationDraft(draft, fallbackDate) {
  if (!draft || typeof draft !== 'object') {
    return null;
  }

  const fecha = draft.fecha && String(draft.fecha).trim() ? String(draft.fecha).trim() : fallbackDate;
  const horaInicio = ensureTimeWithSeconds(draft.hora_inicio);
  const duracionHorasNumero = Number.parseInt(draft.duracion_horas, 10);
  const tipoReserva = draft.tipo_reserva === 'privada' ? 'privada' : 'relacionada';

  const payload = {
    fecha,
    hora_inicio: horaInicio,
    duracion_horas: Number.isInteger(duracionHorasNumero) ? duracionHorasNumero : undefined,
    grabacion_solicitada: !!draft.grabacion_solicitada,
    tipo_reserva: tipoReserva,
  };

  if (draft.cancha_id !== undefined && draft.cancha_id !== null) {
    const canchaNumero = Number(draft.cancha_id);
    if (!Number.isNaN(canchaNumero)) {
      payload.cancha_id = canchaNumero;
    }
  }

  const contactoNombre = draft.contacto_nombre && String(draft.contacto_nombre).trim();
  if (contactoNombre) {
    payload.contacto_nombre = contactoNombre;
  }

  const contactoApellido = draft.contacto_apellido && String(draft.contacto_apellido).trim();
  if (contactoApellido) {
    payload.contacto_apellido = contactoApellido;
  }

  const contactoTelefono = draft.contacto_telefono && String(draft.contacto_telefono).trim();
  if (contactoTelefono) {
    payload.contacto_telefono = contactoTelefono;
  }

  const contactoEmail = draft.contacto_email && String(draft.contacto_email).trim();
  if (contactoEmail) {
    payload.contacto_email = contactoEmail;
  }

  if (tipoReserva === 'relacionada') {
    const jugadorCandidate =
      draft.jugador_usuario_id ?? draft.jugador?.id ?? draft.jugador?.jugador_id ?? null;
    if (jugadorCandidate !== null && jugadorCandidate !== undefined) {
      const jugadorId = Number(jugadorCandidate);
      if (!Number.isNaN(jugadorId)) {
        payload.jugador_usuario_id = jugadorId;
      }
    }
  }

  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function buildTimeSlots(reservations, slotMinutes = SLOT_MINUTES) {
  const minutesList = Array.isArray(reservations)
    ? reservations
        .flatMap((item) => [timeToMinutes(item?.horaInicio), timeToMinutes(item?.horaFin)])
        .filter((value) => typeof value === 'number' && !Number.isNaN(value))
    : [];

  const defaultStart = 8 * 60;
  const defaultEnd = 23 * 60;
  const minMinutes = Math.min(defaultStart, ...minutesList);
  const maxMinutes = Math.max(defaultEnd, ...minutesList);

  const start = Math.floor(minMinutes / slotMinutes) * slotMinutes;
  const end = Math.ceil(maxMinutes / slotMinutes) * slotMinutes;

  const slots = [];
  for (let minute = start; minute <= end; minute += slotMinutes) {
    slots.push({
      start: minute,
      end: minute + slotMinutes,
      label: `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`,
    });
  }
  return slots;
}

function getReservationSegments(reservations, slots, slotMinutes = SLOT_MINUTES) {
  const segments = [];
  const skip = new Set();
  const list = Array.isArray(reservations) ? reservations : [];

  slots.forEach((slot, index) => {
    if (skip.has(index)) {
      segments.push({ type: 'spacer', key: `skip-${index}` });
      return;
    }

    const reservation = list.find((item) => {
      const start = timeToMinutes(item?.horaInicio);
      const end = timeToMinutes(item?.horaFin);
      if (start == null || end == null) return false;
      return start <= slot.start && end > slot.start;
    });

    if (!reservation) {
      segments.push({ type: 'empty', key: `empty-${index}` });
      return;
    }

    const start = timeToMinutes(reservation.horaInicio) ?? slot.start;
    const end = timeToMinutes(reservation.horaFin) ?? slot.end;
    const duration = Math.max(end - slot.start, slotMinutes);
    const slotsCovered = Math.max(1, Math.ceil(duration / slotMinutes));

    for (let i = 1; i < slotsCovered; i += 1) {
      skip.add(index + i);
    }

    segments.push({
      type: 'reservation',
      key: `reservation-${reservation.reservaId ?? `${start}-${end}`}`,
      reservation,
      slotsCovered,
    });
  });

  return segments;
}

function buildAvailableDates(baseDate) {
  const dates = [];
  const anchor = baseDate instanceof Date ? baseDate : parseDateString(baseDate);
  const startDate = anchor || new Date();
  for (let offset = -3; offset <= 10; offset += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + offset);
    date.setHours(0, 0, 0, 0);
    const value = formatDateForApi(date);
    dates.push({
      value,
      label: formatDisplayDate(date),
    });
  }
  return dates;
}

const DEFAULT_PANEL_STATE = {
  fecha: '',
  horaActual: '',
  totales: { hoy: {}, semana: {} },
  resumenEstadosHoy: [],
  agenda: [],
  enCurso: { jugandoAhora: [], proximos: [], siguiente: null },
};

export default function ReservasScreen({ summary, go }) {
  const [selectedDate, setSelectedDate] = useState(() => formatDateForApi(new Date()));
  const [dateInput, setDateInput] = useState(() => formatDateForApi(new Date()));
  const [panelData, setPanelData] = useState(DEFAULT_PANEL_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const allReservations = useMemo(() => {
    if (!panelData?.agenda) return [];
    return panelData.agenda.flatMap((court) => court?.reservas || []);
  }, [panelData]);

  const timeSlots = useMemo(() => buildTimeSlots(allReservations), [allReservations]);

  const selectedDateObj = useMemo(() => parseDateString(selectedDate), [selectedDate]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');
    getReservationsPanel({ date: selectedDate })
      .then((data) => {
        if (!isMounted) return;
        setPanelData(data || DEFAULT_PANEL_STATE);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err?.message || 'No pudimos cargar las reservas para esta fecha.');
        setPanelData(DEFAULT_PANEL_STATE);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDate, refreshToken]);

  useEffect(() => {
    setDateInput(selectedDate);
  }, [selectedDate]);

  const metrics = useMemo(() => {
    const hoy = panelData?.totales?.hoy || {};
    const estados = panelData?.resumenEstadosHoy || [];
    const canceladas = hoy.canceladas ?? estados.find((item) => item.estado === 'cancelada')?.total ?? 0;
    const activas = hoy.activas ?? estados.find((item) => item.estado === 'activa')?.total ?? 0;
    return [
      {
        label: 'Reservas de hoy',
        value: hoy.total ?? summary?.reservasHoy ?? 0,
        icon: 'calendar',
      },
      {
        label: 'Activas',
        value: activas,
        icon: 'radio-button-on',
      },
      {
        label: 'Canceladas',
        value: canceladas,
        icon: 'close-circle',
      },
      {
        label: 'Ingresos estimados',
        value: formatCurrency(hoy.montoTotal ?? 0),
        icon: 'cash',
      },
    ];
  }, [panelData, summary]);

  const courts = useMemo(
    () =>
      (panelData?.agenda || []).map((item) => ({
        cancha_id: item.canchaId,
        nombre: item.canchaNombre || `Cancha ${item.canchaId}`,
      })),
    [panelData]
  );

  const availableDates = useMemo(() => buildAvailableDates(selectedDateObj || new Date()), [selectedDateObj]);

  const availableStartTimes = useMemo(() => {
    const options = [];
    for (let hour = 7; hour <= 23; hour += 1) {
      const value = `${pad(hour)}:00`;
      options.push({ value, label: `${pad(hour)}:00` });
      options.push({ value: `${pad(hour)}:30`, label: `${pad(hour)}:30` });
    }
    return options;
  }, []);

  const handleChangeDateBy = useCallback(
    (offset) => {
      const current = selectedDateObj || new Date();
      const next = new Date(current);
      next.setDate(current.getDate() + offset);
      setSelectedDate(formatDateForApi(next));
    },
    [selectedDateObj]
  );

  const handleDateInputSubmit = useCallback(() => {
    const parsed = parseDateString(dateInput);
    if (!parsed) {
      setDateInput(selectedDate);
      return;
    }
    setSelectedDate(formatDateForApi(parsed));
  }, [dateInput, selectedDate]);

  const handleCreateReservation = useCallback(
    async (draft) => {
      if (!draft) return;
      const normalizedPayload = normalizeReservationDraft(draft, selectedDate);
      if (!normalizedPayload) return;

      try {
        setCreating(true);
        await createClubReservation(normalizedPayload);
        setShowModal(false);
        setSelectedDate(normalizedPayload.fecha || selectedDate);
        setRefreshToken((token) => token + 1);
      } catch (err) {
        Alert.alert('No pudimos crear la reserva', err?.message || 'Intentá de nuevo en unos minutos.');
      } finally {
        setCreating(false);
      }
    },
    [selectedDate]
  );

  const handleDeleteReservation = useCallback((reservaId) => {
    if (reservaId === undefined || reservaId === null) {
      return;
    }

    Alert.alert(
      'Eliminar reserva',
      '¿Querés eliminar esta reserva?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteClubReservation(reservaId);
              setRefreshToken((token) => token + 1);
            } catch (err) {
              Alert.alert(
                'No pudimos eliminar la reserva',
                err?.message || 'Intentá de nuevo en unos minutos.'
              );
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [setRefreshToken]);

  const renderTimeline = () => {
    if (!panelData?.agenda?.length) {
      return (
        <View className="items-center justify-center py-16">
          <Ionicons name="calendar-outline" size={28} color="#94A3B8" />
          <Text className="text-white/70 text-sm mt-3 text-center">
            No hay reservas cargadas para esta fecha. Añadí una nueva reserva para comenzar.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="px-5">
        <View className="flex-row">
          <View className="w-20">
            <View className="border-b border-white/5 px-2 py-3">
              <Text className="text-white/60 text-xs uppercase tracking-widest">Hora</Text>
            </View>
            {timeSlots.map((slot) => (
              <View
                key={`slot-${slot.start}`}
                style={{ height: SLOT_HEIGHT }}
                className="border-b border-white/5 px-2"
              >
                <Text className="text-white/50 text-xs mt-2">{slot.label}</Text>
              </View>
            ))}
          </View>

          {panelData.agenda.map((court, index) => {
            const color = COURT_COLORS[index % COURT_COLORS.length];
            const segments = getReservationSegments(court.reservas, timeSlots);

            return (
              <View key={court.canchaId} className="min-w-[220px] border-l border-white/5">
                <View className="border-b border-white/5 px-4 py-3 flex-row items-center gap-2">
                  <View className={`h-9 w-9 items-center justify-center rounded-xl border ${color.border} ${color.bg}`}>
                    <Ionicons name="tennisball" size={18} color="#FACC15" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                      {court.canchaNombre || `Cancha ${court.canchaId}`}
                    </Text>
                    <Text className="text-white/40 text-[11px]">{panelData?.fecha}</Text>
                  </View>
                </View>

                <View>
                  {segments.map((segment, segmentIndex) => {
                    const slotsCovered =
                      segment && Number.isFinite(segment.slotsCovered)
                        ? Math.max(1, segment.slotsCovered)
                        : 1;
                    const containerHeight = SLOT_HEIGHT * slotsCovered;

                    if (segment.type === 'reservation' && segment.reservation) {
                      const { reservation } = segment;
                      const camera = reservation.grabacionSolicitada;
                      const contactName =
                        [reservation.contactoNombre, reservation.contactoApellido]
                          .filter(Boolean)
                          .join(' ') ||
                        [reservation.usuarioNombre, reservation.usuarioApellido]
                          .filter(Boolean)
                          .join(' ');
                      const timeRange = `${formatTime(reservation.horaInicio)} - ${formatTime(reservation.horaFin)}`;

                      return (
                        <View
                          key={segment.key || `reservation-${segmentIndex}`}
                          style={{ height: containerHeight }}
                          className="border-b border-white/5 px-3 py-2"
                        >
                          <View
                            className={`flex-1 rounded-2xl border px-4 py-3 shadow-sm ${color.bg} ${color.border}`}
                          >
                            <View className="flex-row items-center justify-between">
                              <Text className={`text-sm font-semibold ${color.text}`} numberOfLines={1}>
                                {contactName || 'Reserva privada'}
                              </Text>
                              <View className="flex-row items-center gap-2">
                                {camera ? <Ionicons name="videocam" size={16} color="#FACC15" /> : null}
                                {reservation.reservaId != null ? (
                                  <Pressable
                                    onPress={() => handleDeleteReservation(reservation.reservaId)}
                                    hitSlop={8}
                                    className="h-7 w-7 items-center justify-center rounded-full bg-white/10"
                                  >
                                    <Ionicons name="trash" size={14} color="#F8FAFC" />
                                  </Pressable>
                                ) : null}
                              </View>
                            </View>
                            <Text className="text-white text-[13px] mt-1">{timeRange}</Text>
                            <Text className="text-white/60 text-[11px] mt-1" numberOfLines={2}>
                              Estado: {reservation.estado || 'sin estado'}
                            </Text>
                            {reservation.contactoTelefono ? (
                              <Text className="text-white/40 text-[11px] mt-1">
                                {reservation.contactoTelefono}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    }

                    if (segment.type === 'empty') {
                      return (
                        <View
                          key={segment.key || `empty-${segmentIndex}`}
                          style={{ height: containerHeight }}
                          className="border-b border-dashed border-white/5 px-3 py-2"
                        >
                          <View className="flex-1 rounded-2xl border border-white/5 border-dashed" />
                        </View>
                      );
                    }

                    return (
                      <View
                        key={segment.key || `skip-${segmentIndex}`}
                        style={{ height: containerHeight }}
                        className="border-b border-transparent px-3 py-2"
                      />
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  const renderMatchCard = (reservation) => {
    if (!reservation) return null;
    const camera = reservation.grabacionSolicitada;
    const contactName =
      [reservation.contactoNombre, reservation.contactoApellido].filter(Boolean).join(' ') ||
      [reservation.usuarioNombre, reservation.usuarioApellido].filter(Boolean).join(' ') ||
      'Reserva privada';
    const timeRange = `${formatTime(reservation.horaInicio)} - ${formatTime(reservation.horaFin)}`;

    return (
      <View
        key={reservation.reservaId ?? `${reservation.canchaId}-${reservation.horaInicio}`}
        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-white text-sm font-semibold" numberOfLines={1}>
              {contactName}
            </Text>
            <Text className="text-white/60 text-xs mt-1" numberOfLines={1}>
              {reservation.canchaNombre || `Cancha ${reservation.canchaId}`}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            {camera ? (
              <View className="h-8 w-8 items-center justify-center rounded-xl bg-mc-warn/20">
                <Ionicons name="videocam" size={16} color="#FACC15" />
              </View>
            ) : null}
            {reservation.reservaId != null ? (
              <Pressable
                onPress={() => handleDeleteReservation(reservation.reservaId)}
                hitSlop={8}
                className="h-8 w-8 items-center justify-center rounded-xl bg-white/10"
              >
                <Ionicons name="trash" size={16} color="#F8FAFC" />
              </Pressable>
            ) : null}
          </View>
        </View>
        <Text className="text-white text-sm mt-3">{timeRange}</Text>
        {reservation.contactoTelefono ? (
          <Text className="text-white/60 text-xs mt-1">{reservation.contactoTelefono}</Text>
        ) : null}
      </View>
    );
  };

  const jugandoAhora = panelData?.enCurso?.jugandoAhora || [];
  const proximos = panelData?.enCurso?.proximos || [];

  return (
    <>
      <View className="py-6 flex-row flex-wrap items-start justify-between gap-4">
        <View>
          <Text className="text-white text-[36px] font-extrabold tracking-tight">Reservas</Text>
          <Text className="text-white/60 mt-1">Gestioná las reservas y seguí la agenda de tus canchas</Text>
          {typeof go === 'function' ? (
            <Pressable
              onPress={() => go('mis-canchas')}
              className="mt-3 flex-row items-center gap-2 self-start rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5"
            >
              <Ionicons name="tennisball-outline" size={14} color="#E2E8F0" />
              <Text className="text-white/70 text-xs font-medium uppercase tracking-widest">
                Ver canchas
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setShowModal(true)}
          className="flex-row items-center gap-2 rounded-2xl bg-mc-warn px-4 py-2 shadow-lg hover:bg-mc-warn/80"
        >
          <Ionicons name="add" size={18} color="#0A0F1D" />
          <Text className="text-[#0A0F1D] text-sm font-semibold uppercase tracking-wide">
            Añadir reserva
          </Text>
        </Pressable>
      </View>

      <Card className="mb-6">
        <View className="flex-row flex-wrap items-center gap-3">
          <Pressable
            onPress={() => handleChangeDateBy(-1)}
            className="h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5"
          >
            <Ionicons name="chevron-back" size={18} color="#E2E8F0" />
          </Pressable>
          <Pressable
            onPress={() => {
              const today = formatDateForApi(new Date());
              setSelectedDate(today);
            }}
            className="h-10 rounded-2xl border border-white/10 bg-white/5 px-4 justify-center"
          >
            <Text className="text-white/80 text-sm font-medium">Hoy</Text>
          </Pressable>
          <View className="flex-1 min-w-[200px]">
            <Text className="text-white text-base font-semibold" numberOfLines={1}>
              {formatDisplayDate(selectedDateObj || selectedDate) || 'Seleccioná una fecha'}
            </Text>
            <Text className="text-white/40 text-xs">
              Hora actual: {panelData?.horaActual ? formatTime(panelData.horaActual) : '--:--'} hs
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <TextInput
              value={dateInput}
              onChangeText={setDateInput}
              onSubmitEditing={handleDateInputSubmit}
              onBlur={handleDateInputSubmit}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#64748B"
              className="min-w-[130px] rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
            <Pressable
              onPress={() => handleChangeDateBy(1)}
              className="h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5"
            >
              <Ionicons name="chevron-forward" size={18} color="#E2E8F0" />
            </Pressable>
          </View>
        </View>
      </Card>

      {loading ? (
        <Card className="items-center justify-center py-16">
          <ActivityIndicator color="#F59E0B" size="large" />
          <Text className="text-white/70 text-sm mt-4">Cargando reservas para la fecha seleccionada...</Text>
        </Card>
      ) : error ? (
        <Card className="items-center justify-center gap-4 py-16">
          <Ionicons name="warning" size={28} color="#F97316" />
          <Text className="text-white/80 text-sm text-center px-4">{error}</Text>
          <Pressable
            onPress={() => setRefreshToken((token) => token + 1)}
            className="rounded-2xl border border-mc-warn bg-mc-warn/10 px-4 py-2"
          >
            <Text className="text-mc-warn text-sm font-medium">Reintentar</Text>
          </Pressable>
        </Card>
      ) : (
        <>
          <View className="flex-row flex-wrap gap-4 mb-6">
            {metrics.map((metric) => (
              <Card key={metric.label} className="flex-1 min-w-[180px]">
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-white/5">
                    <Ionicons name={metric.icon} size={18} color="#FACC15" />
                  </View>
                  <View>
                    <Text className="text-white/50 text-xs uppercase tracking-widest">{metric.label}</Text>
                    <Text className="text-white text-xl font-semibold mt-1">{metric.value}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>

          <View className="flex-col xl:flex-row gap-6">
            <Card className="flex-1">
              <Text className="text-white text-lg font-semibold">Agenda del día</Text>
              <Text className="text-white/60 text-xs mt-1">
                Visualizá las reservas por cancha en la fecha seleccionada
              </Text>
              <View className="mt-4 rounded-3xl border border-white/5 bg-white/5 overflow-hidden">
                {renderTimeline()}
              </View>
            </Card>

            <View className="w-full xl:w-[320px] flex-col gap-6">
              <Card>
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-white text-lg font-semibold">Jugando ahora</Text>
                  <Ionicons name="flash" size={18} color="#FACC15" />
                </View>
                <View className="gap-3">
                  {jugandoAhora.length === 0
                    ? (
                        <View className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 items-center">
                          <Ionicons name="time-outline" size={22} color="#94A3B8" />
                          <Text className="text-white/60 text-sm mt-2 text-center">
                            Ninguna cancha tiene partidos en curso en este momento.
                          </Text>
                        </View>
                      )
                    : jugandoAhora.map((reservation) => renderMatchCard(reservation))}
                </View>
              </Card>

              <Card>
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-white text-lg font-semibold">Próximos partidos</Text>
                  <Ionicons name="calendar-outline" size={18} color="#FACC15" />
                </View>
                <View className="gap-3">
                  {proximos.length === 0
                    ? (
                        <View className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 items-center">
                          <Ionicons name="calendar" size={22} color="#94A3B8" />
                          <Text className="text-white/60 text-sm mt-2 text-center">
                            Todavía no hay reservas próximas para mostrar.
                          </Text>
                        </View>
                      )
                    : proximos.map((reservation) => renderMatchCard(reservation))}
                </View>
              </Card>
            </View>
          </View>
        </>
      )}

      <ReservationFormModal
        visible={showModal}
        onDismiss={() => {
          if (!creating) setShowModal(false);
        }}
        onSubmit={handleCreateReservation}
        loading={creating}
        initialValues={{ fecha: selectedDate }}
        courts={courts}
        availableDates={availableDates}
        availableStartTimes={availableStartTimes}
        cameraPrice={panelData?.club?.precioGrabacion}
      />
    </>
  );
}

