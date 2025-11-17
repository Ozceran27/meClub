import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
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
  updateReservationStatus,
} from '../../lib/api';
import { calculateBaseAmount, determineRateType, toNumberOrNull } from './pricing';

const COURT_COLORS = [
  { bg: 'bg-emerald-500/20', border: 'border-emerald-400/40', text: 'text-emerald-200' },
  { bg: 'bg-sky-500/20', border: 'border-sky-400/40', text: 'text-sky-200' },
  { bg: 'bg-violet-500/20', border: 'border-violet-400/40', text: 'text-violet-200' },
  { bg: 'bg-orange-500/20', border: 'border-orange-400/40', text: 'text-orange-200' },
  { bg: 'bg-rose-500/20', border: 'border-rose-400/40', text: 'text-rose-200' },
];

const STATUS_STYLES = {
  confirmada: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-400/40',
    text: 'text-emerald-100',
  },
  pendiente: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-400/40',
    text: 'text-amber-100',
  },
  finalizada: {
    bg: 'bg-indigo-500/20',
    border: 'border-indigo-400/40',
    text: 'text-indigo-100',
  },
  cancelada: {
    bg: 'bg-rose-500/20',
    border: 'border-rose-400/40',
    text: 'text-rose-100',
  },
};

const RESERVATION_STATUS_ALIASES = {
  activa: 'confirmada',
  'en curso': 'confirmada',
  en_curso: 'confirmada',
  pagada: 'confirmada',
  pagado: 'confirmada',
  pago: 'confirmada',
  confirmada: 'confirmada',
  pendiente: 'pendiente',
  reprogramada: 'pendiente',
  reprogramado: 'pendiente',
  finalizada: 'finalizada',
  finalizado: 'finalizada',
  completada: 'finalizada',
  completado: 'finalizada',
  cancelada: 'cancelada',
};

const RESERVATION_STATUS_LABELS = {
  confirmada: 'Confirmada',
  pendiente: 'Pendiente',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
};

const RESERVATION_STATUS_LABEL_OVERRIDES = {
  activa: 'Activa',
};

const PAYMENT_STATUS_DETAILS = {
  pendiente: {
    label: 'Pendiente de Pago',
    icon: 'remove-circle',
    iconColor: '#CBD5E1',
    backendValue: 'sin_abonar',
    backendValues: ['sin_abonar', 'pendiente', 'pendiente_pago', 'sin_pagar'],
    badge: {
      bg: 'bg-slate-500/20',
      border: 'border-slate-400/40',
      text: 'text-slate-100',
    },
  },
  senado: {
    label: 'Señado',
    icon: 'cash-outline',
    iconColor: '#38BDF8',
    backendValue: 'senia',
    backendValues: ['senia', 'senia_parcial', 'senia_total', 'seña'],
    badge: {
      bg: 'bg-sky-500/20',
      border: 'border-sky-400/40',
      text: 'text-sky-100',
    },
  },
  pagado: {
    label: 'Pagado',
    icon: 'checkmark-circle',
    iconColor: '#4ADE80',
    backendValue: 'pagada_total',
    backendValues: [
      'pagada_total',
      'pagada',
      'pagado',
      'pago',
      'pagada_parcial',
      'pago_parcial',
      'abonada',
      'abonado',
      'abonada_parcial',
      'abonado_parcial',
      'abonada_total',
      'abono',
    ],
    badge: {
      bg: 'bg-emerald-500/20',
      border: 'border-emerald-400/40',
      text: 'text-emerald-100',
    },
  },
  cancelado: {
    label: 'Cancelado',
    icon: 'close-circle',
    iconColor: '#F87171',
    backendValue: 'sin_abonar',
    backendValues: ['cancelada', 'cancelado'],
    badge: {
      bg: 'bg-rose-500/20',
      border: 'border-rose-400/40',
      text: 'text-rose-100',
    },
  },
};

const PAYMENT_STATUS_ALIASES = {
  pendiente: 'pendiente',
  'pendiente de pago': 'pendiente',
  sin_abonar: 'pendiente',
  'sin abonar': 'pendiente',
  pendiente_pago: 'pendiente',
  sin_pagar: 'pendiente',
  senado: 'senado',
  senia: 'senado',
  'seña': 'senado',
  'señado': 'senado',
  senia_parcial: 'senado',
  senia_total: 'senado',
  pagada: 'pagado',
  pagado: 'pagado',
  pago: 'pagado',
  pagada_parcial: 'pagado',
  pago_parcial: 'pagado',
  pagada_total: 'pagado',
  abonada: 'pagado',
  abonado: 'pagado',
  abonada_parcial: 'pagado',
  abonado_parcial: 'pagado',
  abonada_total: 'pagado',
  abono: 'pagado',
  cancelada: 'cancelado',
  cancelado: 'cancelado',
};

const RESERVATION_STATUS_OPTIONS = [
  { value: 'confirmada', label: 'Activa (Confirmada)' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'finalizada', label: 'Finalizada' },
  { value: 'cancelada', label: 'Cancelada' },
];

const PAYMENT_STATUS_OPTIONS = Object.entries(PAYMENT_STATUS_DETAILS).map(([value, detail]) => ({
  value,
  label: detail.label,
  icon: detail.icon,
}));

const DEFAULT_PAYMENT_BADGE = {
  bg: 'bg-slate-500/20',
  border: 'border-slate-400/30',
  text: 'text-slate-100',
  iconColor: '#E2E8F0',
  icon: 'cash-outline',
  label: 'Sin registrar',
};

const pickFirstNumber = (...values) => {
  for (const value of values) {
    const numeric = toNumberOrNull(value);
    if (numeric !== null) {
      return numeric;
    }
  }
  return null;
};

function formatStatusLabel(value, { emptyLabel = 'Sin estado' } = {}) {
  if (!value) {
    return emptyLabel;
  }
  const normalized = String(value).trim().toLowerCase();
  const resolved = normalizeStatusValue(value);
  const label =
    RESERVATION_STATUS_LABEL_OVERRIDES[normalized] ||
    RESERVATION_STATUS_LABEL_OVERRIDES[resolved] ||
    RESERVATION_STATUS_LABELS[resolved];
  if (label) {
    return label;
  }
  return String(value)
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeStatusValue(value) {
  if (!value) {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  return RESERVATION_STATUS_ALIASES[normalized] || normalized || null;
}

function getStatusBadgeClasses(status) {
  if (!status) {
    return {
      bg: 'bg-slate-500/20',
      border: 'border-slate-400/30',
      text: 'text-slate-100',
    };
  }
  const normalized = normalizeStatusValue(status);
  return STATUS_STYLES[normalized] || {
    bg: 'bg-slate-500/20',
    border: 'border-slate-400/30',
    text: 'text-slate-100',
  };
}

function normalizePaymentStatusValue(status) {
  if (!status) {
    return null;
  }
  const normalized = String(status).trim().toLowerCase();
  const alias = PAYMENT_STATUS_ALIASES[normalized];
  if (alias && PAYMENT_STATUS_DETAILS[alias]) {
    return alias;
  }

  for (const [key, detail] of Object.entries(PAYMENT_STATUS_DETAILS)) {
    if (key === normalized) {
      return key;
    }
    if (
      Array.isArray(detail.backendValues) &&
      detail.backendValues.some((value) => String(value).toLowerCase() === normalized)
    ) {
      return key;
    }
  }

  return null;
}

function getPaymentStatusDetails(status) {
  const resolved = normalizePaymentStatusValue(status);
  if (!resolved) {
    return null;
  }
  const detail = PAYMENT_STATUS_DETAILS[resolved];
  return detail ? { ...detail, value: resolved } : null;
}

function getPaymentBackendValue(status) {
  const resolved = normalizePaymentStatusValue(status);
  if (!resolved) {
    return null;
  }
  const detail = PAYMENT_STATUS_DETAILS[resolved];
  if (!detail) {
    return null;
  }
  const backendValue = detail.backendValue || detail.backendValues?.[0];
  return backendValue || resolved;
}

const SLOT_MINUTES = 60;
const SLOT_HEIGHT = 68;
const TIME_COLUMN_WIDTH = 220;

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

function TimelineReservationCard({
  reservation,
  color,
  containerHeight,
  onDelete,
  onPress,
  court,
  nightStart,
  nightEnd,
}) {
  const [isHovered, setIsHovered] = useState(false);

  if (!reservation) {
    return null;
  }

  const camera = reservation.grabacionSolicitada;
  const contactName =
    [reservation.contactoNombre, reservation.contactoApellido]
      .filter(Boolean)
      .join(' ') ||
    [reservation.usuarioNombre, reservation.usuarioApellido]
      .filter(Boolean)
      .join(' ') ||
    'Reserva privada';
  const timeRange = `${formatTime(reservation.horaInicio)} - ${formatTime(reservation.horaFin)}`;
  const statusClasses = getStatusBadgeClasses(reservation.estado);
  const statusLabel = formatStatusLabel(reservation.estado, { emptyLabel: 'Sin estado' });
  const paymentDetail = getPaymentStatusDetails(reservation.estadoPago);
  const paymentBadgeClasses = paymentDetail?.badge ?? DEFAULT_PAYMENT_BADGE;
  const paymentLabel = paymentDetail?.label ?? formatStatusLabel(reservation.estadoPago, {
    emptyLabel: DEFAULT_PAYMENT_BADGE.label,
  });
  const paymentIconName = paymentDetail?.icon ?? DEFAULT_PAYMENT_BADGE.icon;
  const paymentIconColor = paymentDetail?.iconColor ?? DEFAULT_PAYMENT_BADGE.iconColor;
  const tooltipEnabled = Platform.OS === 'web';
  const showTooltip = tooltipEnabled && isHovered;
  const creatorName =
    [reservation.creadoPorNombre, reservation.creadoPorApellido].filter(Boolean).join(' ') ||
    reservation.creadoPorEmail ||
    'Sin datos';

  const pricingClub = useMemo(
    () => ({
      hora_nocturna_inicio: nightStart ?? null,
      hora_nocturna_fin: nightEnd ?? null,
      horaNocturnaInicio: nightStart ?? null,
      horaNocturnaFin: nightEnd ?? null,
    }),
    [nightEnd, nightStart]
  );

  const durationHours = useMemo(() => {
    const normalized = toNumberOrNull(reservation.duracionHoras);
    if (normalized !== null) {
      return normalized;
    }
    const startMinutes = timeToMinutes(reservation.horaInicio);
    const endMinutes = timeToMinutes(reservation.horaFin);
    if (startMinutes !== null && endMinutes !== null && endMinutes > startMinutes) {
      return (endMinutes - startMinutes) / 60;
    }
    return null;
  }, [reservation.duracionHoras, reservation.horaFin, reservation.horaInicio]);

  const explicitBase = toNumberOrNull(reservation.montoBase);
  const fallbackPrice = pickFirstNumber(
    court?.monto_base,
    court?.precio,
    court?.precioDia,
    court?.precio_dia,
    court?.precioNoche,
    court?.precio_noche
  );

  const derivedBaseAmount = useMemo(
    () =>
      calculateBaseAmount({
        cancha: court || {},
        club: pricingClub,
        horaInicio: reservation.horaInicio,
        duracionHoras: durationHours,
        explicitAmount: explicitBase,
        fallbackAmount: fallbackPrice,
      }),
    [court, explicitBase, fallbackPrice, pricingClub, reservation.horaInicio, durationHours]
  );

  const appliedRateType = determineRateType({ horaInicio: reservation.horaInicio, club: pricingClub });
  const rateLabel =
    appliedRateType === 'night'
      ? 'Tarifa nocturna'
      : appliedRateType === 'day'
      ? 'Tarifa diurna'
      : 'Tarifa estándar';
  const rateBadgeLabel =
    appliedRateType === 'night'
      ? 'Nocturna'
      : appliedRateType === 'day'
      ? 'Diurna'
      : 'Estándar';
  const rateIconName =
    appliedRateType === 'night'
      ? 'flash'
      : appliedRateType === 'day'
      ? 'sunny'
      : 'contrast-outline';
  const rateIconColor =
    appliedRateType === 'night'
      ? '#FACC15'
      : appliedRateType === 'day'
      ? '#38BDF8'
      : '#E2E8F0';

  const handleHoverIn = tooltipEnabled ? () => setIsHovered(true) : undefined;
  const handleHoverOut = tooltipEnabled ? () => setIsHovered(false) : undefined;
  const handleFocus = tooltipEnabled ? () => setIsHovered(true) : undefined;
  const handleBlur = tooltipEnabled ? () => setIsHovered(false) : undefined;

  return (
    <View style={{ height: containerHeight }} className="h-full border-b border-white/5 px-2 py-1">
      <Pressable
        className={`relative h-full w-full flex-1 rounded-2xl border shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${color.border}`}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPress={onPress}
      >
        <View className={`flex-1 overflow-hidden rounded-2xl ${color.bg}`}>
          <View className="flex-1 px-2 py-2 justify-between gap-2">
            <View className="flex-row items-start justify-between gap-2">
              <Text
                className={`flex-1 pr-2 text-sm font-semibold ${color.text}`}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {contactName}
              </Text>
              {reservation.estado ? (
                <View className={`rounded-full border px-2 py-0.5 ${statusClasses.bg} ${statusClasses.border}`}>
                  <Text
                    className={`text-[10px] font-semibold uppercase tracking-wide ${statusClasses.text}`}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {statusLabel}
                  </Text>
                </View>
              ) : null}
            </View>

            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-row items-center gap-2">
                {camera ? (
                  <View className="h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/20">
                    <Ionicons name="videocam" size={14} color="#FACC15" />
                  </View>
                ) : null}
                <View className="flex-row items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-0.5">
                  <Ionicons name={rateIconName} size={12} color={rateIconColor} />
                  <Text className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                    {rateBadgeLabel}
                  </Text>
                </View>
                <View
                  className={`flex-row items-center gap-1 rounded-full border px-2 py-0.5 ${paymentBadgeClasses.bg} ${paymentBadgeClasses.border}`}
                >
                  <Ionicons name={paymentIconName} size={12} color={paymentIconColor} />
                  <Text
                    className={`text-[10px] font-semibold uppercase tracking-wide ${paymentBadgeClasses.text}`}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {paymentLabel}
                  </Text>
                </View>
              </View>

              <Text className="text-white text-[12px] font-medium" numberOfLines={1} ellipsizeMode="tail">
                {timeRange}
              </Text>
            </View>
          </View>
        </View>

        {onDelete ? (
          <Pressable
            onPress={onDelete}
            hitSlop={8}
            className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full bg-black/50"
          >
            <Ionicons name="trash" size={14} color="#F8FAFC" />
          </Pressable>
        ) : null}

        {showTooltip ? (
          <View pointerEvents="none" className="absolute left-0 right-0 top-full z-20 mt-2 px-2">
            <View className="overflow-hidden rounded-xl border border-white/20 bg-slate-950/95 p-3 shadow-xl shadow-black/40">
              <Text className="text-white text-xs font-semibold" numberOfLines={2} ellipsizeMode="tail">
                {contactName}
              </Text>
              <View className="mt-2 space-y-1">
                <Text className="text-white/70 text-[11px]" numberOfLines={1} ellipsizeMode="tail">
                  Estado: <Text className="text-white">{statusLabel}</Text>
                </Text>
                <Text className="text-white/70 text-[11px]" numberOfLines={1} ellipsizeMode="tail">
                  Estado de pago: <Text className="text-white">{paymentLabel}</Text>
                </Text>
                <Text className="text-white/70 text-[11px]" numberOfLines={1} ellipsizeMode="tail">
                  Tarifa aplicada: <Text className="text-white">{rateLabel}</Text>
                </Text>
                <Text className="text-white/70 text-[11px]" numberOfLines={1} ellipsizeMode="tail">
                  Teléfono: <Text className="text-white">{reservation.contactoTelefono || 'Sin teléfono'}</Text>
                </Text>
                <Text className="text-white/70 text-[11px]" numberOfLines={1} ellipsizeMode="tail">
                  Ingreso estimado:{' '}
                  <Text className="text-white">{formatCurrency(derivedBaseAmount)}</Text>
                </Text>
                <Text className="text-white/70 text-[11px]" numberOfLines={1} ellipsizeMode="tail">
                  Monto registrado:{' '}
                  <Text className="text-white">{formatCurrency(reservation.monto)}</Text>
                </Text>
                <Text className="text-white/70 text-[11px]" numberOfLines={1} ellipsizeMode="tail">
                  Creador: <Text className="text-white">{creatorName}</Text>
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

function ReservationStatusMenu({
  visible,
  reservation,
  onClose,
  onSave,
  saving,
  error,
}) {
  const [selectedStatus, setSelectedStatus] = useState(() => normalizeStatusValue(reservation?.estado));
  const [selectedPayment, setSelectedPayment] = useState(() => {
    const detail = getPaymentStatusDetails(reservation?.estadoPago);
    return detail?.value ?? null;
  });

  useEffect(() => {
    setSelectedStatus(normalizeStatusValue(reservation?.estado));
    const detail = getPaymentStatusDetails(reservation?.estadoPago);
    setSelectedPayment(detail?.value ?? null);
  }, [reservation, visible]);

  const statusOptions = useMemo(() => {
    const normalized = normalizeStatusValue(reservation?.estado);
    const hasCurrent = normalized
      ? RESERVATION_STATUS_OPTIONS.some((option) => option.value === normalized)
      : true;
    if (hasCurrent) {
      return RESERVATION_STATUS_OPTIONS;
    }
    return [
      { value: normalized, label: formatStatusLabel(normalized) },
      ...RESERVATION_STATUS_OPTIONS,
    ];
  }, [reservation]);

  const paymentOptions = useMemo(() => {
    const detail = getPaymentStatusDetails(reservation?.estadoPago);
    const normalized = detail?.value ?? null;
    const hasCurrent = normalized
      ? PAYMENT_STATUS_OPTIONS.some((option) => option.value === normalized)
      : true;
    if (hasCurrent) {
      return PAYMENT_STATUS_OPTIONS;
    }
    return detail
      ? [{ value: detail.value, label: detail.label, icon: detail.icon }, ...PAYMENT_STATUS_OPTIONS]
      : PAYMENT_STATUS_OPTIONS;
  }, [reservation]);

  const handleSave = useCallback(() => {
    onSave?.({ estado: selectedStatus, estadoPago: selectedPayment });
  }, [onSave, selectedPayment, selectedStatus]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-slate-950/80 px-4">
        <View className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-5">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-white text-lg font-semibold">Actualizar estado</Text>
              <Text className="text-white/60 text-xs mt-1">
                Seleccioná el estado general y de pago para la reserva.
              </Text>
              {reservation ? (
                <View className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <Text className="text-white text-sm font-semibold" numberOfLines={1} ellipsizeMode="tail">
                    {[
                      reservation.contactoNombre,
                      reservation.contactoApellido,
                    ]
                      .filter(Boolean)
                      .join(' ') ||
                      [reservation.usuarioNombre, reservation.usuarioApellido]
                        .filter(Boolean)
                        .join(' ') ||
                      'Reserva privada'}
                  </Text>
                  <Text className="text-white/60 text-[11px] mt-1" numberOfLines={1} ellipsizeMode="tail">
                    {reservation.horaInicio && reservation.horaFin
                      ? `${formatTime(reservation.horaInicio)} - ${formatTime(reservation.horaFin)}`
                      : reservation.horaInicio || 'Sin horario'}
                  </Text>
                </View>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              disabled={saving}
              hitSlop={8}
              className="h-8 w-8 items-center justify-center rounded-full bg-white/5"
            >
              <Ionicons name="close" size={18} color="#E2E8F0" />
            </Pressable>
          </View>

          <View className="mt-5">
            <Text className="text-white/70 text-xs uppercase tracking-widest">Estado</Text>
            <View className="mt-2 gap-2">
              {statusOptions.map((option) => {
                const isSelected = selectedStatus === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setSelectedStatus(option.value)}
                    className={`flex-row items-center justify-between rounded-2xl border px-3 py-2 ${
                      isSelected ? 'border-mc-warn bg-mc-warn/10' : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <Text className="text-white text-sm" numberOfLines={1} ellipsizeMode="tail">
                      {option.label}
                    </Text>
                    {isSelected ? <Ionicons name="checkmark-circle" size={16} color="#FACC15" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="mt-5">
            <Text className="text-white/70 text-xs uppercase tracking-widest">Estado de pago</Text>
            <View className="mt-2 gap-2">
              {paymentOptions.map((option) => {
                const isSelected = selectedPayment === option.value;
                const detail = PAYMENT_STATUS_DETAILS[option.value] ?? DEFAULT_PAYMENT_BADGE;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setSelectedPayment(option.value)}
                    className={`flex-row items-center justify-between rounded-2xl border px-3 py-2 ${
                      isSelected ? 'border-mc-warn bg-mc-warn/10' : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <View className="flex-row items-center gap-2">
                      <View
                        className={`h-8 w-8 items-center justify-center rounded-full border ${
                          detail.badge?.border ?? DEFAULT_PAYMENT_BADGE.border
                        } ${detail.badge?.bg ?? DEFAULT_PAYMENT_BADGE.bg}`}
                      >
                        <Ionicons
                          name={option.icon}
                          size={16}
                          color={detail.iconColor ?? DEFAULT_PAYMENT_BADGE.iconColor}
                        />
                      </View>
                      <Text className="text-white text-sm" numberOfLines={1} ellipsizeMode="tail">
                        {option.label}
                      </Text>
                    </View>
                    {isSelected ? <Ionicons name="checkmark-circle" size={16} color="#FACC15" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {error ? (
            <Text className="text-rose-300 text-xs mt-4" numberOfLines={2} ellipsizeMode="tail">
              {error}
            </Text>
          ) : null}

          <View className="mt-6 flex-row items-center justify-end gap-3">
            <Pressable
              onPress={onClose}
              disabled={saving}
              className="h-10 px-4 items-center justify-center rounded-2xl border border-white/10 bg-white/5"
            >
              <Text className="text-white text-sm font-medium">Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              className="h-10 min-w-[140px] flex-row items-center justify-center gap-2 rounded-2xl border border-mc-warn bg-mc-warn/10 px-4"
            >
              {saving ? <ActivityIndicator color="#FACC15" size="small" /> : null}
              <Text className="text-mc-warn text-sm font-semibold">Guardar cambios</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
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

  const estadoPagoRaw =
    draft.estado_pago ?? draft.estadoPago ?? draft.estado?.pago ?? draft.estado?.estado_pago ?? null;
  if (estadoPagoRaw !== null && estadoPagoRaw !== undefined) {
    const estadoPago = getPaymentBackendValue(estadoPagoRaw);
    if (estadoPago) {
      payload.estado_pago = estadoPago;
    }
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
  const effectiveSlotMinutes = Number.isFinite(slotMinutes) && slotMinutes > 0 ? slotMinutes : SLOT_MINUTES;
  const timelineStart = slots?.[0]?.start ?? 0;

  slots.forEach((slot, index) => {
    if (skip.has(index)) {
      segments.push({ type: 'spacer', key: `skip-${index}` });
      return;
    }

    const reservation = list.find((item) => {
      const start = timeToMinutes(item?.horaInicio);
      const end = timeToMinutes(item?.horaFin);
      if (start == null || end == null) return false;
      if (!(start < slot.end && end > slot.start)) {
        return false;
      }
      const anchorIndex = Math.max(0, Math.floor((start - timelineStart) / effectiveSlotMinutes));
      return anchorIndex === index;
    });

    if (!reservation) {
      segments.push({ type: 'empty', key: `empty-${index}` });
      return;
    }

    const start = timeToMinutes(reservation.horaInicio);
    const end = timeToMinutes(reservation.horaFin);
    const validStart = Number.isFinite(start) ? start : slot.start;
    const validEnd = Number.isFinite(end) ? end : validStart + effectiveSlotMinutes;
    const rawDuration = validEnd - validStart;
    const duration = rawDuration > 0 ? rawDuration : effectiveSlotMinutes;
    const slotsCovered = Math.max(1, Math.ceil(duration / effectiveSlotMinutes));

    for (let i = 1; i < slotsCovered; i += 1) {
      const skipIndex = index + i;
      if (skipIndex < slots.length) {
        skip.add(skipIndex);
      }
    }

    segments.push({
      type: 'reservation',
      key: `reservation-${reservation.reservaId ?? `${validStart}-${validEnd}`}`,
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
  const [creationError, setCreationError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [statusMenuVisible, setStatusMenuVisible] = useState(false);
  const [statusMenuReservation, setStatusMenuReservation] = useState(null);
  const [updatingReservationStatus, setUpdatingReservationStatus] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState('');

  const allReservations = useMemo(() => {
    if (!panelData?.agenda) return [];
    return panelData.agenda.flatMap((court) => court?.reservas || []);
  }, [panelData]);

  const timeSlots = useMemo(() => buildTimeSlots(allReservations), [allReservations]);

  const selectedDateObj = useMemo(() => parseDateString(selectedDate), [selectedDate]);

  const nightStartValue =
    panelData?.club?.horaNocturnaInicio ?? panelData?.club?.hora_nocturna_inicio ?? null;
  const nightEndValue = panelData?.club?.horaNocturnaFin ?? panelData?.club?.hora_nocturna_fin ?? null;

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
    const incomeStates = new Set([
      'pendiente',
      'pagada',
      'pagado',
      'finalizada',
      'finalizado',
      'completada',
      'completado',
    ]);

    const hasReservations = panelData?.agenda?.some(
      (court) => Array.isArray(court?.reservas) && court.reservas.length > 0
    );

    const ingresosDesdeReservas = hasReservations
      ? panelData.agenda.reduce((total, court) => {
          const reservas = Array.isArray(court?.reservas) ? court.reservas : [];
          const fallbackAmount = pickFirstNumber(
            court?.monto_base,
            court?.precio,
            court?.precioDia,
            court?.precio_dia,
            court?.precioNoche,
            court?.precio_noche
          );

          const courtTotal = reservas.reduce((subtotal, reserva) => {
            if (!reserva) return subtotal;

            const normalizedStatus = normalizeStatusValue(reserva.estado);
            if (normalizedStatus === 'cancelada') {
              return subtotal;
            }

            const monto = toNumberOrNull(reserva.monto);
            if (monto !== null) {
              return subtotal + monto;
            }

            const duration = (() => {
              const explicit = toNumberOrNull(reserva?.duracionHoras ?? reserva?.duracion_horas);
              if (explicit !== null) {
                return explicit;
              }
              const startMinutes = timeToMinutes(reserva?.horaInicio ?? reserva?.hora_inicio);
              const endMinutes = timeToMinutes(reserva?.horaFin ?? reserva?.hora_fin);
              if (startMinutes !== null && endMinutes !== null && endMinutes > startMinutes) {
                return (endMinutes - startMinutes) / 60;
              }
              return null;
            })();

            const derivedAmount = calculateBaseAmount({
              cancha: court || {},
              club: panelData?.club || {},
              horaInicio: reserva?.horaInicio ?? reserva?.hora_inicio,
              duracionHoras: duration,
              explicitAmount: pickFirstNumber(reserva?.montoBase, reserva?.monto_base),
              fallbackAmount,
            });

            return subtotal + (Number.isFinite(derivedAmount) ? derivedAmount : 0);
          }, 0);

          return total + courtTotal;
        }, 0)
      : null;

    const ingresosEstimados =
      ingresosDesdeReservas !== null
        ? ingresosDesdeReservas
        : estados.length
        ? estados.reduce((total, item) => {
            const estado = String(item?.estado ?? '').trim().toLowerCase();
            if (!incomeStates.has(estado)) {
              return total;
            }
            return total + (Number.isFinite(item?.montoTotal) ? item.montoTotal : 0);
          }, 0)
        : hoy.montoTotal ?? 0;
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
        value: formatCurrency(ingresosEstimados),
        icon: 'cash',
      },
    ];
  }, [panelData, summary]);

  const courts = useMemo(
    () =>
      (panelData?.agenda || []).map((item) => ({
        cancha_id: item.canchaId,
        nombre: item.canchaNombre || `Cancha ${item.canchaId}`,
        precio: toNumberOrNull(item?.precio),
        precioDia: pickFirstNumber(item?.precioDia, item?.precio_dia),
        precioNoche: pickFirstNumber(item?.precioNoche, item?.precio_noche),
        precio_dia: pickFirstNumber(item?.precioDia, item?.precio_dia),
        precio_noche: pickFirstNumber(item?.precioNoche, item?.precio_noche),
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
        setCreationError('');
        setCreating(true);
        await createClubReservation(normalizedPayload);
        setShowModal(false);
        setSelectedDate(normalizedPayload.fecha || selectedDate);
        setRefreshToken((token) => token + 1);
      } catch (err) {
        const message = err?.message || 'Intentá de nuevo en unos minutos.';
        setCreationError(message);
        Alert.alert('No pudimos crear la reserva', message);
      } finally {
        setCreating(false);
      }
    },
    [selectedDate]
  );

  const handleOpenModal = useCallback(() => {
    setCreationError('');
    setShowModal(true);
  }, []);

  const handleDismissModal = useCallback(() => {
    if (creating) return;
    setShowModal(false);
    setCreationError('');
  }, [creating]);

  const handleClearCreationError = useCallback(() => {
    setCreationError('');
  }, []);

  const handleDeleteReservation = useCallback(
    (reservaId) => {
      if (reservaId === undefined || reservaId === null) {
        return;
      }

      const confirmDeletion = async () => {
        try {
          await deleteClubReservation(reservaId);
          setRefreshToken((token) => token + 1);
        } catch (err) {
          Alert.alert(
            'No pudimos eliminar la reserva',
            err?.message || 'Intentá de nuevo en unos minutos.'
          );
        }
      };

      if (Platform.OS === 'web') {
        const confirmed =
          typeof window !== 'undefined'
            ? window.confirm('¿Querés eliminar esta reserva?')
            : false;
        if (confirmed) {
          confirmDeletion();
        }
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
            onPress: confirmDeletion,
          },
        ],
        { cancelable: true }
      );
    },
    [setRefreshToken]
  );

  const handleOpenStatusMenu = useCallback((reservation) => {
    if (!reservation || reservation.reservaId == null) {
      return;
    }
    setStatusMenuReservation(reservation);
    setStatusUpdateError('');
    setStatusMenuVisible(true);
  }, []);

  const handleCloseStatusMenu = useCallback(() => {
    if (updatingReservationStatus) {
      return;
    }
    setStatusMenuVisible(false);
    setStatusMenuReservation(null);
    setStatusUpdateError('');
  }, [updatingReservationStatus]);

  const handleSaveStatusMenu = useCallback(
    async ({ estado, estadoPago }) => {
      if (!statusMenuReservation || statusMenuReservation.reservaId == null) {
        return;
      }

      const currentEstado = normalizeStatusValue(statusMenuReservation.estado);
      const nextEstado = estado ?? currentEstado;
      const currentEstadoPago = normalizePaymentStatusValue(statusMenuReservation.estadoPago);
      const nextEstadoPago = normalizePaymentStatusValue(estadoPago ?? currentEstadoPago);
      const hasEstadoChange = nextEstado !== currentEstado;
      const hasPagoChange = nextEstadoPago !== currentEstadoPago;

      if (!hasEstadoChange && !hasPagoChange) {
        setStatusMenuVisible(false);
        setStatusMenuReservation(null);
        return;
      }

      const payload = { reservaId: statusMenuReservation.reservaId };
      if (hasEstadoChange && nextEstado) {
        payload.estado = nextEstado;
      }
      if (hasPagoChange && nextEstadoPago) {
        payload.estado_pago = getPaymentBackendValue(nextEstadoPago);
      }

      if (!payload.estado && !payload.estado_pago) {
        setStatusMenuVisible(false);
        setStatusMenuReservation(null);
        return;
      }

      setStatusUpdateError('');
      setUpdatingReservationStatus(true);

      try {
        await updateReservationStatus(payload);
        setStatusMenuVisible(false);
        setStatusMenuReservation(null);
        setRefreshToken((token) => token + 1);
      } catch (err) {
        setStatusUpdateError(err?.message || 'No pudimos actualizar la reserva.');
      } finally {
        setUpdatingReservationStatus(false);
      }
    },
    [setRefreshToken, statusMenuReservation]
  );

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
          <View style={{ width: TIME_COLUMN_WIDTH }}>
            <View
              style={{ height: SLOT_HEIGHT }}
              className="border-b border-white/5 px-4 items-center justify-center"
            >
              <Text className="text-white/60 text-xs uppercase tracking-widest">Hora</Text>
            </View>
            {timeSlots.map((slot) => (
              <View
                key={`slot-${slot.start}`}
                style={{ height: SLOT_HEIGHT }}
                className="border-b border-white/5 px-4 justify-center"
              >
                <Text className="text-white/50 text-xs">{slot.label}</Text>
              </View>
            ))}
          </View>

          {panelData.agenda.map((court, index) => {
            const color = COURT_COLORS[index % COURT_COLORS.length];
            const segments = getReservationSegments(court.reservas, timeSlots);

            return (
              <View key={court.canchaId} style={{ minWidth: TIME_COLUMN_WIDTH }} className="border-l border-white/5">
                <View
                  style={{ height: SLOT_HEIGHT }}
                  className="border-b border-white/5 px-4 flex-row items-center gap-2"
                >
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

                      return (
                        <TimelineReservationCard
                          key={segment.key || `reservation-${segmentIndex}`}
                          reservation={reservation}
                          color={color}
                          containerHeight={containerHeight}
                          onDelete={
                            reservation.reservaId != null
                              ? () => handleDeleteReservation(reservation.reservaId)
                              : undefined
                          }
                          onPress={
                            reservation.reservaId != null
                              ? () => handleOpenStatusMenu(reservation)
                              : undefined
                          }
                          court={court}
                          nightStart={nightStartValue}
                          nightEnd={nightEndValue}
                        />
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
          onPress={handleOpenModal}
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
        onDismiss={handleDismissModal}
        onSubmit={handleCreateReservation}
        loading={creating}
        initialValues={{ fecha: selectedDate }}
        courts={courts}
        availableDates={availableDates}
        availableStartTimes={availableStartTimes}
        cameraPrice={panelData?.club?.precioGrabacion}
        nightStart={nightStartValue}
        nightEnd={nightEndValue}
        submissionError={creationError}
        onClearSubmissionError={handleClearCreationError}
      />

      <ReservationStatusMenu
        visible={statusMenuVisible}
        reservation={statusMenuReservation}
        onClose={handleCloseStatusMenu}
        onSave={handleSaveStatusMenu}
        saving={updatingReservationStatus}
        error={statusUpdateError}
      />
    </>
  );
}

