import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/Card';
import ModalContainer from '../../components/ModalContainer';
import { searchPlayers } from '../../lib/api';
import { calculateBaseAmount, toNumberOrNull } from './pricing';

const FIELD_STYLES =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-mc-warn';

const RESERVATION_TYPES = [
  { value: 'relacionada', label: 'Reserva relacionada' },
  { value: 'privada', label: 'Reserva privada' },
];

const DEFAULT_VALUES = {
  tipo_reserva: 'privada',
  cancha_id: null,
  fecha: null,
  hora_inicio: null,
  duracion_horas: null,
  monto_base: null,
  monto_grabacion: null,
  con_grabacion: false,
  contacto_nombre: '',
  contacto_apellido: '',
  contacto_telefono: '',
  contacto_email: '',
  jugador: null,
};

const DURATION_HOURS_OPTIONS = Array.from({ length: 8 }, (_, index) => {
  const hours = index + 1;
  return {
    value: hours,
    label: `${hours} hora${hours === 1 ? '' : 's'}`,
  };
});

const pickFirstNumber = (...values) => {
  for (const value of values) {
    const numeric = toNumberOrNull(value);
    if (numeric !== null) {
      return numeric;
    }
  }
  return null;
};

function useInitialValues(initialValues) {
  return useMemo(() => {
    if (!initialValues || typeof initialValues !== 'object') {
      return DEFAULT_VALUES;
    }

    const safe = { ...DEFAULT_VALUES, ...initialValues };

    const hoursValue = Number(safe.duracion_horas);
    const minutesValue = Number(safe.duracion);
    let normalizedHours = null;
    if (safe.duracion_horas !== null && safe.duracion_horas !== undefined && Number.isFinite(hoursValue)) {
      if (hoursValue > 0) {
        normalizedHours = Math.min(Math.max(Math.round(hoursValue), 1), 8);
      }
    } else if (safe.duracion !== null && safe.duracion !== undefined && Number.isFinite(minutesValue)) {
      const derived = minutesValue / 60;
      if (derived > 0) {
        normalizedHours = Math.min(Math.max(Math.round(derived), 1), 8);
      }
    }

    return {
      ...safe,
      tipo_reserva: safe.tipo_reserva === 'relacionada' ? 'relacionada' : 'privada',
      cancha_id: safe.cancha_id ?? null,
      fecha: safe.fecha ?? null,
      hora_inicio: safe.hora_inicio ?? null,
      duracion_horas: normalizedHours,
      monto_base:
        safe.monto_base === null || safe.monto_base === undefined
          ? null
          : Number(safe.monto_base),
      monto_grabacion:
        safe.monto_grabacion === null || safe.monto_grabacion === undefined
          ? null
          : Number(safe.monto_grabacion),
      con_grabacion: safe.grabacion_solicitada != null ? !!safe.grabacion_solicitada : !!safe.con_grabacion,
      contacto_nombre: safe.contacto_nombre || '',
      contacto_apellido: safe.contacto_apellido || '',
      contacto_telefono: safe.contacto_telefono || '',
      contacto_email: safe.contacto_email || '',
      jugador: safe.jugador || null,
    };
  }, [initialValues]);
}

function ensureArray(value) {
  if (!Array.isArray(value)) return [];
  return value;
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '-';
  if (!Number.isFinite(Number(value))) return '-';
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch (err) {
    return `$${Math.round(Number(value))}`;
  }
}

const parsePromotionDate = (value) => {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  const candidate = normalized.includes('T') ? normalized : normalized.replace(' ', 'T');
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildReservationDateTime = (date, time) => {
  if (!date || !time) return null;
  const normalizedTime = String(time).length === 5 ? `${time}:00` : time;
  const parsed = new Date(`${date}T${normalizedTime}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const calculateDiscountAmount = ({ baseAmount, tipo_descuento, valor }) => {
  const base = Number(baseAmount) || 0;
  const discountValue = Number(valor);
  if (!base || !Number.isFinite(discountValue) || discountValue <= 0) return 0;
  if (tipo_descuento === 'porcentaje') {
    return Math.min(base, (base * discountValue) / 100);
  }
  if (tipo_descuento === 'nominal') {
    return Math.min(base, discountValue);
  }
  return 0;
};

export default function ReservationFormModal({
  visible,
  title = 'Crear reserva',
  onDismiss,
  onSubmit,
  loading,
  initialValues,
  courts = [],
  availableDates = [],
  availableStartTimes = [],
  cameraPrice = 0,
  promotions = [],
  fetchPlayers = searchPlayers,
  nightStart = null,
  nightEnd = null,
  submissionError = '',
  onClearSubmissionError,
}) {
  const parsedInitialValues = useInitialValues(initialValues);
  const [form, setForm] = useState(parsedInitialValues);
  const [errors, setErrors] = useState({});
  const [showCourtPicker, setShowCourtPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [playerQuery, setPlayerQuery] = useState('');
  const [playerResults, setPlayerResults] = useState([]);
  const [searchingPlayers, setSearchingPlayers] = useState(false);
  const [playerSearchError, setPlayerSearchError] = useState('');

  const handleFormInteraction = useCallback(() => {
    if (submissionError) {
      onClearSubmissionError?.();
    }
  }, [onClearSubmissionError, submissionError]);

  useEffect(() => {
    if (!visible) return;
    setForm(parsedInitialValues);
    setErrors({});
    setPlayerQuery('');
    setPlayerResults([]);
    setPlayerSearchError('');
    setShowCourtPicker(false);
    setShowDatePicker(false);
    setShowStartPicker(false);
    setShowDurationPicker(false);
  }, [visible, parsedInitialValues]);

  const selectedCourt = useMemo(() => {
    if (!form.cancha_id) return null;
    return ensureArray(courts).find((court) => String(court.cancha_id ?? court.id) === String(form.cancha_id));
  }, [courts, form.cancha_id]);

  const cameraFee = useMemo(() => {
    if (cameraPrice !== null && cameraPrice !== undefined && Number.isFinite(Number(cameraPrice))) {
      return Number(cameraPrice);
    }
    if (parsedInitialValues.monto_grabacion !== null && parsedInitialValues.monto_grabacion !== undefined) {
      return Number(parsedInitialValues.monto_grabacion);
    }
    return 0;
  }, [cameraPrice, parsedInitialValues.monto_grabacion]);

  const pricingClub = useMemo(
    () => ({
      hora_nocturna_inicio: nightStart ?? null,
      hora_nocturna_fin: nightEnd ?? null,
      horaNocturnaInicio: nightStart ?? null,
      horaNocturnaFin: nightEnd ?? null,
    }),
    [nightStart, nightEnd]
  );

  const baseAmount = useMemo(() => {
    const explicitBase = pickFirstNumber(form.monto_base, parsedInitialValues.monto_base);
    const fallbackPrice = pickFirstNumber(
      selectedCourt?.monto_base,
      selectedCourt?.precio,
      selectedCourt?.precioDia,
      selectedCourt?.precio_dia,
      selectedCourt?.precioNoche,
      selectedCourt?.precio_noche
    );

    return calculateBaseAmount({
      cancha: selectedCourt || {},
      club: pricingClub,
      horaInicio: form.hora_inicio,
      duracionHoras: form.duracion_horas,
      explicitAmount: explicitBase,
      fallbackAmount: fallbackPrice,
    });
  }, [
    form.monto_base,
    form.hora_inicio,
    form.duracion_horas,
    parsedInitialValues.monto_base,
    pricingClub,
    selectedCourt,
  ]);

  const appliedPromotion = useMemo(() => {
    if (!selectedCourt || !form.fecha || !form.hora_inicio) {
      return null;
    }
    const start = buildReservationDateTime(form.fecha, form.hora_inicio);
    if (!start) return null;
    const duration = Number(form.duracion_horas) || 1;
    const end = new Date(start.getTime() + duration * 60 * 60 * 1000);

    const courtId = selectedCourt?.cancha_id ?? selectedCourt?.id;
    let bestPromotion = null;

    ensureArray(promotions).forEach((promotion) => {
      if (promotion?.activo === false) return;
      const promoStart = parsePromotionDate(promotion?.fecha_inicio ?? promotion?.fechaInicio);
      const promoEnd = parsePromotionDate(promotion?.fecha_fin ?? promotion?.fechaFin);
      if (!promoStart || !promoEnd) return;
      if (start < promoStart || end > promoEnd) return;

      const canchas = Array.isArray(promotion?.canchas_aplicadas)
        ? promotion.canchas_aplicadas
        : Array.isArray(promotion?.canchasAplicadas)
          ? promotion.canchasAplicadas
          : [];
      if (canchas.length > 0 && !canchas.some((id) => String(id) === String(courtId))) {
        return;
      }

      const discountAmount = calculateDiscountAmount({
        baseAmount,
        tipo_descuento: promotion?.tipo_descuento ?? promotion?.tipoDescuento,
        valor: promotion?.valor,
      });

      if (discountAmount <= 0) return;
      if (!bestPromotion || discountAmount > bestPromotion.discountAmount) {
        bestPromotion = { ...promotion, discountAmount };
      }
    });

    return bestPromotion;
  }, [
    baseAmount,
    form.duracion_horas,
    form.fecha,
    form.hora_inicio,
    promotions,
    selectedCourt,
  ]);

  const promotionDiscount = appliedPromotion?.discountAmount ?? 0;

  const totalAmount = useMemo(() => {
    const base = Number(baseAmount) || 0;
    const extra = form.con_grabacion ? Number(cameraFee) || 0 : 0;
    const discount = Number(promotionDiscount) || 0;
    return Math.max(0, base - discount) + extra;
  }, [baseAmount, cameraFee, form.con_grabacion, promotionDiscount]);

  useEffect(() => {
    if (form.tipo_reserva !== 'relacionada') {
      return;
    }
    const trimmed = playerQuery.trim();
    if (trimmed.length < 2) {
      setPlayerResults([]);
      setPlayerSearchError('');
      return;
    }
    let cancelled = false;
    setSearchingPlayers(true);
    setPlayerSearchError('');
    fetchPlayers(trimmed, { limit: 10 })
      .then((result) => {
        if (cancelled) return;
        if (Array.isArray(result?.results)) {
          setPlayerResults(result.results);
        } else if (Array.isArray(result)) {
          setPlayerResults(result);
        } else {
          setPlayerResults([]);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setPlayerSearchError(err?.message || 'No pudimos buscar jugadores');
        setPlayerResults([]);
      })
      .finally(() => {
        if (!cancelled) {
          setSearchingPlayers(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPlayers, form.tipo_reserva, playerQuery]);

  const handleChange = (key, value) => {
    handleFormInteraction();
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSelectValue = (key, value) => {
    handleFormInteraction();
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const handleTypeChange = (value) => {
    handleFormInteraction();
    setForm((prev) => ({
      ...prev,
      tipo_reserva: value,
      jugador: value === 'relacionada' ? prev.jugador : null,
      contacto_nombre: value === 'privada' ? prev.contacto_nombre : '',
      contacto_apellido: value === 'privada' ? prev.contacto_apellido : '',
      contacto_telefono: value === 'privada' ? prev.contacto_telefono : '',
      contacto_email: value === 'privada' ? prev.contacto_email : '',
    }));
    setErrors((prev) => ({
      ...prev,
      jugador: null,
      contacto_nombre: null,
      contacto_apellido: null,
      contacto_telefono: null,
    }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.tipo_reserva) {
      nextErrors.tipo_reserva = 'Seleccioná un tipo de reserva';
    }

    if (!form.cancha_id) {
      nextErrors.cancha_id = 'Seleccioná una cancha';
    }

    if (!form.fecha) {
      nextErrors.fecha = 'Seleccioná una fecha';
    }

    if (!form.hora_inicio) {
      nextErrors.hora_inicio = 'Seleccioná un horario';
    }

    const duracionHoras = Number(form.duracion_horas);
    if (!duracionHoras) {
      nextErrors.duracion_horas = 'Seleccioná una duración';
    } else if (!Number.isInteger(duracionHoras) || duracionHoras < 1 || duracionHoras > 8) {
      nextErrors.duracion_horas = 'La duración debe ser un entero entre 1 y 8 horas';
    }

    if (form.tipo_reserva === 'privada') {
      if (!form.contacto_nombre || !String(form.contacto_nombre).trim()) {
        nextErrors.contacto_nombre = 'Ingresá un nombre de contacto';
      }
      if (!form.contacto_apellido || !String(form.contacto_apellido).trim()) {
        nextErrors.contacto_apellido = 'Ingresá un apellido de contacto';
      }
      if (!form.contacto_telefono || !String(form.contacto_telefono).trim()) {
        nextErrors.contacto_telefono = 'Ingresá un teléfono de contacto';
      }
    }

    if (form.tipo_reserva === 'relacionada') {
      const jugadorId = form.jugador?.id ?? form.jugador?.jugador_id;
      if (!jugadorId) {
        nextErrors.jugador = 'Seleccioná un jugador';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    handleFormInteraction();
    if (loading) return;
    if (!validate()) return;

    const payload = {
      tipo_reserva: form.tipo_reserva,
      cancha_id: form.cancha_id ? Number(form.cancha_id) : null,
      fecha: form.fecha,
      hora_inicio: form.hora_inicio,
      duracion_horas: form.duracion_horas ? Number(form.duracion_horas) : null,
      grabacion_solicitada: !!form.con_grabacion,
      contacto_nombre: form.contacto_nombre?.trim() || '',
      contacto_apellido: form.contacto_apellido?.trim() || '',
      contacto_telefono: form.contacto_telefono?.trim() || '',
      contacto_email: form.contacto_email?.trim() || '',
    };

    if (form.tipo_reserva === 'relacionada') {
      payload.jugador_usuario_id = form.jugador?.id ?? form.jugador?.jugador_id ?? null;
    }

    onSubmit?.(payload);
  };

  const renderPickerModal = ({ visible: pickerVisible, onClose, options, selectedValue, onSelect, title: pickerTitle, emptyText = 'No hay datos disponibles' }) => {
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
          <ScrollView className="max-h-[360px]" contentContainerClassName="pb-2">
            {ensureArray(options).map((option) => {
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
            {ensureArray(options).length === 0 ? (
              <Text className="text-white/60 text-sm text-center">{emptyText}</Text>
            ) : null}
          </ScrollView>
        </Card>
      </ModalContainer>
    );
  };

  const renderPlayerResults = () => {
    if (form.tipo_reserva !== 'relacionada') return null;
    if (playerQuery.trim().length < 2) return null;

    if (searchingPlayers) {
      return (
        <View className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex-row items-center gap-2">
          <ActivityIndicator color="#FACC15" />
          <Text className="text-white/70 text-sm">Buscando jugadores...</Text>
        </View>
      );
    }

    if (playerSearchError) {
      return (
        <View className="mt-2 rounded-2xl border border-mc-warn/40 bg-mc-warn/10 px-4 py-3">
          <Text className="text-mc-warn text-sm">{playerSearchError}</Text>
        </View>
      );
    }

    if (playerResults.length === 0) {
      return (
        <View className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <Text className="text-white/60 text-sm">No encontramos jugadores con esa búsqueda</Text>
        </View>
      );
    }

    return (
      <View className="mt-2 rounded-2xl border border-white/10 bg-white/5">
        {playerResults.map((player) => {
          const value = player.id ?? player.jugador_id;
          const active = form.jugador && String(form.jugador.id ?? form.jugador.jugador_id) === String(value);
          return (
            <Pressable
              key={value}
              onPress={() => {
                handleChange('jugador', player);
                setErrors((prev) => ({ ...prev, jugador: null }));
              }}
              className={`px-4 py-3 border-b border-white/5 ${active ? 'bg-white/10' : 'bg-transparent'}`}
            >
              <Text className="text-white text-sm font-medium">{player.nombre ?? player.name}</Text>
              {player.email ? <Text className="text-white/60 text-xs mt-1">{player.email}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <ModalContainer
      visible={visible}
      onRequestClose={() => {
        handleFormInteraction();
        if (!loading) onDismiss?.();
      }}
    >
      <Card className="w-full max-h-[90vh]">
          <View className="flex-row items-center justify-between mb-6">
            <View>
              <Text className="text-white text-2xl font-bold tracking-tight">{title}</Text>
              <Text className="text-white/60 text-sm mt-1">
                Seleccioná la cancha, fecha y horario para registrar la reserva.
              </Text>
            </View>
            <Pressable
              onPress={() => {
                handleFormInteraction();
                if (!loading) onDismiss?.();
              }}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/5"
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          <ScrollView className="flex-1" contentContainerClassName="pb-6" showsVerticalScrollIndicator={false}>
            <View className="gap-6">
              <View>
                <Text className="text-white/70 text-sm mb-3">Tipo de reserva</Text>
                <View className="flex-row flex-wrap gap-2">
                  {RESERVATION_TYPES.map((type) => {
                    const active = form.tipo_reserva === type.value;
                    return (
                      <Pressable
                        key={type.value}
                        onPress={() => handleTypeChange(type.value)}
                        className={`rounded-2xl px-4 py-2 border text-sm font-medium ${
                          active ? 'border-mc-warn bg-mc-warn/20 text-mc-warn' : 'border-white/10 bg-white/5 text-white/80'
                        }`}
                      >
                        <Text className={active ? 'text-mc-warn' : 'text-white/80'}>{type.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {errors.tipo_reserva ? (
                  <Text className="text-mc-warn text-xs mt-1">{errors.tipo_reserva}</Text>
                ) : null}
              </View>

              <View>
                <Text className="text-white/70 text-sm mb-2">Cancha *</Text>
                <Pressable
                  onPress={() => setShowCourtPicker(true)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <Text className="text-white text-sm">
                    {selectedCourt?.nombre ||
                      ensureArray(courts).find((court) => String(court.cancha_id ?? court.id) === String(form.cancha_id))?.nombre ||
                      'Seleccioná una cancha'}
                  </Text>
                </Pressable>
                {errors.cancha_id ? (
                  <Text className="text-mc-warn text-xs mt-1">{errors.cancha_id}</Text>
                ) : null}
              </View>

              <View className="flex-row flex-wrap gap-4">
                <View className="flex-1 min-w-[160px]">
                  <Text className="text-white/70 text-sm mb-2">Fecha *</Text>
                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <Text className="text-white text-sm">
                      {ensureArray(availableDates).find((option) => String(option.value ?? option.id ?? option) === String(form.fecha))?.label ||
                        form.fecha ||
                        'Seleccioná una fecha'}
                    </Text>
                  </Pressable>
                  {errors.fecha ? <Text className="text-mc-warn text-xs mt-1">{errors.fecha}</Text> : null}
                </View>

                <View className="flex-1 min-w-[160px]">
                  <Text className="text-white/70 text-sm mb-2">Hora de inicio *</Text>
                  <Pressable
                    onPress={() => setShowStartPicker(true)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <Text className="text-white text-sm">
                      {ensureArray(availableStartTimes).find((option) => String(option.value ?? option.id ?? option) === String(form.hora_inicio))?.label ||
                        form.hora_inicio ||
                        'Seleccioná un horario'}
                    </Text>
                  </Pressable>
                  {errors.hora_inicio ? (
                    <Text className="text-mc-warn text-xs mt-1">{errors.hora_inicio}</Text>
                  ) : null}
                </View>

                <View className="flex-1 min-w-[160px]">
                  <Text className="text-white/70 text-sm mb-2">Duración (horas) *</Text>
                  <Pressable
                    onPress={() => setShowDurationPicker(true)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <Text className="text-white text-sm">
                      {ensureArray(DURATION_HOURS_OPTIONS).find((option) => String(option.value ?? option.id ?? option) === String(form.duracion_horas))?.label ||
                        (form.duracion_horas ? `${form.duracion_horas} hora${Number(form.duracion_horas) === 1 ? '' : 's'}` : 'Seleccioná duración')}
                    </Text>
                  </Pressable>
                  {errors.duracion_horas ? (
                    <Text className="text-mc-warn text-xs mt-1">{errors.duracion_horas}</Text>
                  ) : null}
                </View>
              </View>

              <View>
                <Text className="text-white/70 text-sm mb-2">Cámara y grabación</Text>
                <View className="flex-row items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <View>
                    <Text className="text-white text-sm font-medium">Agregar grabación del turno</Text>
                    <Text className="text-white/50 text-xs">
                      Se sumará el costo adicional fijo de {formatCurrency(cameraFee)} solo si activás la grabación.
                    </Text>
                  </View>
                  <Switch
                    value={!!form.con_grabacion}
                    onValueChange={(value) => handleChange('con_grabacion', value)}
                  />
                </View>
              </View>

              <View className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <Text className="text-white text-sm font-semibold mb-3">Resumen de precios</Text>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-white/70 text-sm">Monto base</Text>
                  <Text className="text-white text-sm font-medium">{formatCurrency(baseAmount)}</Text>
                </View>
                {appliedPromotion ? (
                  <View className="mb-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white/70 text-sm">Promoción aplicada</Text>
                      <Text className="text-white text-sm font-medium">
                        {appliedPromotion.nombre ?? appliedPromotion.name ?? 'Promoción'}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between mt-1">
                      <Text className="text-emerald-300 text-sm">Descuento</Text>
                      <Text className="text-emerald-300 text-sm font-medium">
                        -{formatCurrency(promotionDiscount)}
                      </Text>
                    </View>
                  </View>
                ) : null}
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-white/70 text-sm">Grabación</Text>
                  <Text className="text-white text-sm font-medium">
                    {form.con_grabacion ? formatCurrency(cameraFee) : formatCurrency(0)}
                  </Text>
                </View>
                <View className="h-px bg-white/5 my-2" />
                <View className="flex-row items-center justify-between">
                  <Text className="text-white text-sm font-semibold">Total</Text>
                  <Text className="text-mc-warn text-base font-semibold">{formatCurrency(totalAmount)}</Text>
                </View>
              </View>

              {form.tipo_reserva === 'privada' ? (
                <View className="gap-4">
                  <Text className="text-white/70 text-sm">Datos de contacto</Text>
                  <View>
                    <Text className="text-white/70 text-xs mb-1">Nombre *</Text>
                    <TextInput
                      value={form.contacto_nombre}
                      onChangeText={(text) => handleChange('contacto_nombre', text)}
                      placeholder="Nombre"
                      placeholderTextColor="#94A3B8"
                      className={FIELD_STYLES}
                    />
                    {errors.contacto_nombre ? (
                      <Text className="text-mc-warn text-xs mt-1">{errors.contacto_nombre}</Text>
                    ) : null}
                  </View>
                  <View>
                    <Text className="text-white/70 text-xs mb-1">Apellido *</Text>
                    <TextInput
                      value={form.contacto_apellido}
                      onChangeText={(text) => handleChange('contacto_apellido', text)}
                      placeholder="Apellido"
                      placeholderTextColor="#94A3B8"
                      className={FIELD_STYLES}
                    />
                    {errors.contacto_apellido ? (
                      <Text className="text-mc-warn text-xs mt-1">{errors.contacto_apellido}</Text>
                    ) : null}
                  </View>
                  <View>
                    <Text className="text-white/70 text-xs mb-1">Teléfono *</Text>
                    <TextInput
                      value={form.contacto_telefono}
                      onChangeText={(text) => handleChange('contacto_telefono', text)}
                      keyboardType="phone-pad"
                      placeholder="Ej: 3511234567"
                      placeholderTextColor="#94A3B8"
                      className={FIELD_STYLES}
                    />
                    {errors.contacto_telefono ? (
                      <Text className="text-mc-warn text-xs mt-1">{errors.contacto_telefono}</Text>
                    ) : null}
                  </View>
                  <View>
                    <Text className="text-white/70 text-xs mb-1">Email</Text>
                    <TextInput
                      value={form.contacto_email}
                      onChangeText={(text) => handleChange('contacto_email', text)}
                      keyboardType="email-address"
                      placeholder="nombre@correo.com"
                      placeholderTextColor="#94A3B8"
                      className={FIELD_STYLES}
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              ) : null}

              {form.tipo_reserva === 'relacionada' ? (
                <View>
                  <Text className="text-white/70 text-sm mb-2">Buscar jugador *</Text>
                  <TextInput
                    value={playerQuery}
                    onChangeText={(text) => {
                      handleFormInteraction();
                      setPlayerQuery(text);
                    }}
                    placeholder="Buscá por nombre o email"
                    placeholderTextColor="#94A3B8"
                    className={FIELD_STYLES}
                    autoCapitalize="none"
                  />
                  {errors.jugador ? (
                    <Text className="text-mc-warn text-xs mt-1">{errors.jugador}</Text>
                  ) : null}
                  {form.jugador ? (
                    <View className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <Text className="text-white text-sm font-medium">
                        Jugador seleccionado: {form.jugador.nombre ?? form.jugador.name}
                      </Text>
                      {form.jugador.email ? (
                        <Text className="text-white/60 text-xs mt-1">{form.jugador.email}</Text>
                      ) : null}
                      <Pressable
                        onPress={() => handleChange('jugador', null)}
                        className="mt-3 self-start rounded-xl border border-white/10 bg-white/5 px-3 py-1"
                      >
                        <Text className="text-white/70 text-xs">Limpiar selección</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {renderPlayerResults()}
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View className="border-t border-white/5 pt-4">
            {submissionError ? (
              <View className="mb-3 rounded-2xl border border-mc-warn/40 bg-mc-warn/10 px-4 py-3">
                <Text className="text-mc-warn text-sm font-medium">{submissionError}</Text>
              </View>
            ) : null}
            <View className="flex-row items-center justify-end gap-3">
              <Pressable
                onPress={() => {
                  handleFormInteraction();
                  if (!loading) onDismiss?.();
                }}
                disabled={loading}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10"
              >
                <Text className="text-white/80 text-sm font-medium">Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                className="rounded-2xl bg-mc-warn px-5 py-2 hover:bg-mc-warn/80"
              >
                <Text className="text-[#0A0F1D] text-sm font-semibold">
                  {loading ? 'Guardando...' : 'Guardar reserva'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Card>
        {renderPickerModal({
          visible: showCourtPicker,
          onClose: () => setShowCourtPicker(false),
          options: ensureArray(courts).map((court) => ({
            value: court.cancha_id ?? court.id,
            label: court.nombre ?? `Cancha #${court.cancha_id ?? court.id}`,
            description: court.descripcion ?? court.deporte?.nombre,
            raw: court,
          })),
          selectedValue: form.cancha_id,
          onSelect: (value) => {
            handleSelectValue('cancha_id', value);
          },
          title: 'Seleccioná una cancha',
          emptyText: 'No encontramos canchas disponibles',
        })}
        {renderPickerModal({
          visible: showDatePicker,
          onClose: () => setShowDatePicker(false),
          options: ensureArray(availableDates),
          selectedValue: form.fecha,
          onSelect: (value, option) => handleSelectValue('fecha', option?.value ?? option?.id ?? option),
          title: 'Seleccioná una fecha',
          emptyText: 'No encontramos fechas disponibles',
        })}
        {renderPickerModal({
          visible: showStartPicker,
          onClose: () => setShowStartPicker(false),
          options: ensureArray(availableStartTimes),
          selectedValue: form.hora_inicio,
          onSelect: (value, option) => handleSelectValue('hora_inicio', option?.value ?? option?.id ?? option),
          title: 'Seleccioná un horario',
          emptyText: 'No encontramos horarios disponibles',
        })}
        {renderPickerModal({
          visible: showDurationPicker,
          onClose: () => setShowDurationPicker(false),
          options: ensureArray(DURATION_HOURS_OPTIONS),
          selectedValue: form.duracion_horas,
          onSelect: (value, option) =>
            handleSelectValue('duracion_horas', Number(option?.value ?? option?.id ?? option)),
          title: 'Seleccioná la duración',
          emptyText: 'No encontramos duraciones disponibles',
        })}
    </ModalContainer>
  );
}
