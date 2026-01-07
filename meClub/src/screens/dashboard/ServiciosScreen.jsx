import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Card from '../../components/Card';
import CardTitle from '../../components/CardTitle';
import ActionButton from '../../components/ActionButton';
import ModalContainer from '../../components/ModalContainer';
import ScreenHeader from '../../components/ScreenHeader';
import {
  createClubServiceEntry,
  deleteClubServiceEntry,
  listClubServiceEntries,
  updateClubServiceEntry,
  getClubSchedule,
  listMemberTypes,
  createMemberType,
  updateMemberType,
  deleteMemberType,
  listMembers,
  createMember,
  deleteMember,
  searchMembers,
  registerMemberPayment,
  searchPlayers,
  getClubCourts,
  createPromotion,
  createCoupon,
} from '../../lib/api';
import { DAYS, normalizeSchedule, normalizeTimeToHHMM } from './configurationState';
import { SERVICE_COLORS, normalizeHexColor } from '../../constants/serviceColors';

const FIELD_STYLES =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-mc-warn';

const MAX_SERVICES = 10;

const MODE_ACCESS_OPTIONS = [
  { value: 'libre', label: 'Libre' },
  { value: 'reserva', label: 'Requiere reserva' },
  { value: 'solo_socios', label: 'Solo socios' },
];

const AMBIENTE_OPTIONS = [
  { value: 'aire_libre', label: 'Aire libre' },
  { value: 'cerrado', label: 'Cerrado' },
];

const PRECIO_TIPO_OPTIONS = [
  { value: 'hora', label: 'Por hora' },
  { value: 'dia', label: 'Por día' },
  { value: 'mes', label: 'Por mes' },
];

const DISCOUNT_TYPE_OPTIONS = [
  { value: 'porcentaje', label: 'Porcentaje' },
  { value: 'nominal', label: 'Monto fijo' },
];

const ICON_OPTIONS = [
  { key: 'no_fumar', label: 'No fumar', icon: 'ban-outline' },
  { key: 'mas_18', label: '+18', icon: 'alert-circle-outline' },
  { key: 'comida', label: 'Comida', icon: 'restaurant-outline' },
  { key: 'eco_friendly', label: 'Eco', icon: 'leaf-outline' },
];

const statusStyles = {
  pagado: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30',
  pendiente: 'bg-amber-500/15 text-amber-200 border border-amber-500/30',
  vencido: 'bg-rose-500/15 text-rose-200 border border-rose-500/30',
};

const buildPromotionForm = () => ({
  nombre: '',
  fecha_inicio: '',
  hora_inicio: '',
  fecha_fin: '',
  hora_fin: '',
  tipo_descuento: '',
  valor: '',
  canchas_aplicadas: [],
});

const buildCouponForm = () => ({
  nombre: '',
  usos_permitidos: '',
  tipo_descuento: '',
  valor: '',
});

const buildMemberTypeForm = () => ({
  nombre: '',
  cuota_mensual: '',
  fecha_pago: '',
  dias_gracia: '',
  color: '#F97316',
  servicios_incluidos: [],
});

const buildMemberForm = () => ({
  usuario_id: null,
  nombre: '',
  apellido: '',
  dni: '',
  telefono: '',
  direccion: '',
  correo: '',
  tipo_asociado_id: null,
});

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

const parseDateInput = (value) => {
  if (!isValidDate(value)) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, month - 1, day);
};

const isValidTime = (value) => {
  if (!value) return false;
  const parts = String(value).split(':');
  if (parts.length < 2 || parts.length > 3) return false;
  const [hours, minutes, seconds = '0'] = parts.map(Number);
  if ([hours, minutes, seconds].some((item) => Number.isNaN(item))) return false;
  if (hours < 0 || hours > 23) return false;
  if (minutes < 0 || minutes > 59) return false;
  if (seconds < 0 || seconds > 59) return false;
  return true;
};

const buildDateTimePayload = (date, time) => {
  if (!date || !time) return null;
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  return `${date} ${normalizedTime}`;
};

function ActionPanel({ visible, title, subtitle, onClose, children }) {
  return (
    <ModalContainer
      visible={visible}
      onRequestClose={onClose}
      animationType="fade"
      contentClassName="items-center justify-center"
    >
      <Card className="w-full max-h-[90vh] bg-[#0F172A] px-6 pb-8 pt-5">
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1">
            <Text className="text-white text-xl font-semibold">{title}</Text>
            {subtitle ? <Text className="text-white/60 mt-1">{subtitle}</Text> : null}
          </View>
          <Pressable
            onPress={onClose}
            className="h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5"
            accessibilityLabel="Cerrar panel"
          >
            <Ionicons name="close" size={18} color="#E2E8F0" />
          </Pressable>
        </View>
        <ScrollView className="mt-6 max-h-[70vh]" contentContainerClassName="gap-4 pb-2">
          {children}
        </ScrollView>
      </Card>
    </ModalContainer>
  );
}

const parseTimeToMinutes = (value) => {
  if (!value) return null;
  const [h, m] = String(value).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const formatMinutes = (value) => {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const buildTimeOptions = (schedule) => {
  const normalized = normalizeSchedule(schedule);
  let earliest = 6 * 60;
  let latest = 23 * 60;

  Object.values(normalized).forEach((day) => {
    if (!day?.enabled || !Array.isArray(day?.ranges)) return;
    day.ranges.forEach((range) => {
      const start = parseTimeToMinutes(normalizeTimeToHHMM(range.start));
      const end = parseTimeToMinutes(normalizeTimeToHHMM(range.end));
      if (start !== null) earliest = Math.min(earliest, start);
      if (end !== null) latest = Math.max(latest, end);
    });
  });

  const options = [];
  for (let minutes = earliest; minutes <= latest; minutes += 30) {
    options.push({ value: formatMinutes(minutes), label: formatMinutes(minutes) });
  }
  return options;
};

const buildServiceDefaults = () => ({
  servicio_id: null,
  nombre: '',
  modo_acceso: 'libre',
  dias_disponibles: [],
  hora_inicio: '',
  hora_fin: '',
  imagen_url: '',
  color: '',
  ambiente: '',
  precio_tipo: '',
  precio_valor: '',
  no_fumar: false,
  mas_18: false,
  comida: false,
  eco_friendly: false,
  activo: true,
});

const parseDiasDisponibles = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((day) => Number(day)).filter((day) => day >= 1 && day <= 7);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((day) => Number(day)).filter((day) => day >= 1 && day <= 7);
      }
    } catch (err) {
      return value
        .split(',')
        .map((day) => Number(day))
        .filter((day) => day >= 1 && day <= 7);
    }
  }
  return [];
};

const normalizeModoAcceso = (value) => {
  if (value === 'requiere_reserva') return 'reserva';
  return value;
};

const normalizeServiceEntry = (service) => {
  if (!service || typeof service !== 'object') return buildServiceDefaults();
  return {
    ...buildServiceDefaults(),
    ...service,
    servicio_id: service.servicio_id ?? service.id ?? service.servicioId ?? null,
    nombre: service.nombre ?? service.name ?? '',
    modo_acceso: normalizeModoAcceso(service.modo_acceso ?? service.modoAcceso ?? 'libre'),
    dias_disponibles: parseDiasDisponibles(
      service.dias_disponibles ?? service.diasDisponibles ?? service.dias,
    ),
    hora_inicio: normalizeTimeToHHMM(service.hora_inicio) || '',
    hora_fin: normalizeTimeToHHMM(service.hora_fin) || '',
    imagen_url: service.imagen_url ?? service.imagenUrl ?? service.imagen ?? '',
    color: service.color ?? '',
    ambiente: service.ambiente ?? '',
    precio_tipo: service.precio_tipo ?? '',
    precio_valor:
      service.precio_valor !== null && service.precio_valor !== undefined
        ? String(service.precio_valor)
        : '',
    no_fumar: Boolean(service.no_fumar),
    mas_18: Boolean(service.mas_18),
    comida: Boolean(service.comida),
    eco_friendly: Boolean(service.eco_friendly),
    activo: service.activo !== undefined ? Boolean(service.activo) : true,
  };
};

const normalizeMemberType = (type) => {
  if (!type || typeof type !== 'object') return null;
  return {
    tipo_asociado_id: type.tipo_asociado_id ?? type.id ?? null,
    nombre: type.nombre ?? '',
    cuota_mensual: type.cuota_mensual ?? null,
    fecha_pago: type.fecha_pago ?? null,
    dias_gracia: type.dias_gracia ?? null,
    color: type.color ?? '#F97316',
    servicios_incluidos: Array.isArray(type.servicios_incluidos) ? type.servicios_incluidos : [],
  };
};

const normalizeMember = (member) => {
  if (!member || typeof member !== 'object') return null;
  const nombre = member.nombre ?? '';
  const apellido = member.apellido ?? '';
  const cuota_mensual = member.cuota_mensual ?? member.tipo?.cuota_mensual ?? null;
  const pagos_realizados =
    member.pagos_realizados !== null && member.pagos_realizados !== undefined
      ? Number(member.pagos_realizados) || 0
      : 0;
  return {
    asociado_id: member.asociado_id ?? member.id ?? null,
    nombre,
    apellido,
    telefono: member.telefono ?? '',
    tipo_nombre: member.tipo_nombre ?? member.tipo?.nombre ?? '',
    estado_pago: member.estado_pago ?? 'pendiente',
    fecha_inscripcion: member.fecha_inscripcion ?? '',
    cuota_mensual,
    pagos_realizados,
    deuda: member.deuda ?? null,
    meses_transcurridos: member.meses_transcurridos ?? null,
    nombre_completo: `${nombre} ${apellido}`.trim(),
  };
};

const calculateMonthsElapsed = (fechaInscripcion) => {
  if (!fechaInscripcion) return 0;
  const startDate = new Date(fechaInscripcion);
  if (Number.isNaN(startDate.getTime())) return 0;
  const today = new Date();
  let months =
    (today.getFullYear() - startDate.getFullYear()) * 12 +
    (today.getMonth() - startDate.getMonth());
  if (today.getDate() >= startDate.getDate()) {
    months += 1;
  }
  return Math.max(months, 0);
};

const calculateDebt = (member) => {
  if (!member) return 0;
  const cuota = Number(member.cuota_mensual) || 0;
  const pagos = Number(member.pagos_realizados) || 0;
  const months = calculateMonthsElapsed(member.fecha_inscripcion);
  return Math.round((cuota * months - pagos) * 100) / 100;
};

function ServiceCard({ service, cardColor, onToggleEdit }) {
  return (
    <Card className="gap-4" style={{ backgroundColor: cardColor }}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-white text-lg font-semibold">
            {service.nombre || 'Nuevo servicio'}
          </Text>
          <Text className="text-white/60 mt-1">
            {service.modo_acceso === 'reserva'
              ? 'Requiere reserva previa'
              : service.modo_acceso === 'solo_socios'
                ? 'Exclusivo para socios'
                : 'Acceso libre'}
          </Text>
        </View>
        <View className="items-end gap-2">
          <Pressable
            onPress={() => onToggleEdit(service.servicio_id)}
            className="flex-row items-center gap-2 rounded-full border border-white/10 px-3 py-1"
          >
            <Ionicons name="pencil" size={14} color="#F8FAFC" />
            <Text className="text-white text-xs font-semibold">Editar</Text>
          </Pressable>
          <View
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              service.activo ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-white/50'
            }`}
          >
            <Text className="text-xs text-white font-semibold">{service.activo ? 'Activo' : 'Pausado'}</Text>
          </View>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-4">
        <View className="flex-1 min-w-[140px]">
          <Text className="text-white/60 text-xs">Horario</Text>
          <Text className="text-white font-semibold">
            {service.hora_inicio && service.hora_fin
              ? `${service.hora_inicio} - ${service.hora_fin}`
              : 'Sin horario'}
          </Text>
        </View>
        <View className="flex-1 min-w-[140px]">
          <Text className="text-white/60 text-xs">Precio</Text>
          <Text className="text-white font-semibold">
            {service.modo_acceso === 'reserva' && service.precio_valor
              ? `$${service.precio_valor} / ${service.precio_tipo || 'hora'}`
              : 'Sin precio'}
          </Text>
        </View>
        <View className="flex-1 min-w-[140px]">
          <Text className="text-white/60 text-xs">Días</Text>
          <Text className="text-white font-semibold">
            {service.dias_disponibles.length
              ? service.dias_disponibles
                  .map((day) => DAYS[day - 1]?.label?.charAt(0))
                  .filter(Boolean)
                  .join(', ')
              : 'Sin definir'}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function ServiceForm({
  service,
  fallbackColor,
  priceEnabled,
  showNameField = true,
  onUpdate,
  onToggleDay,
  onOpenPicker,
  onSelectImage,
  timeOptions,
}) {
  const isPersistedService =
    service.servicio_id && !String(service.servicio_id).startsWith('tmp-');

  return (
    <View className="gap-3">
      {showNameField ? (
        <>
          <TextInput
            value={service.nombre}
            onChangeText={(value) => onUpdate('nombre', value)}
            placeholder="Nombre del servicio"
            placeholderTextColor="#94A3B8"
            editable={!isPersistedService}
            className={`${FIELD_STYLES} ${isPersistedService ? 'opacity-60' : ''}`}
          />
          {isPersistedService ? (
            <Text className="text-white/60 text-xs">
              El nombre no se puede editar luego de crear el servicio.
            </Text>
          ) : null}
        </>
      ) : null}
      <View className="gap-2">
        <Text className="text-white/60 text-xs">Modo de acceso</Text>
        <Pressable
          onPress={() =>
            onOpenPicker('modo_acceso', MODE_ACCESS_OPTIONS, 'Modo de acceso')
          }
          className={`${FIELD_STYLES} flex-row items-center justify-between`}
        >
          <Text className="text-white">
            {MODE_ACCESS_OPTIONS.find((option) => option.value === service.modo_acceso)?.label ||
              'Seleccioná un modo'}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#E2E8F0" />
        </Pressable>
      </View>

      <View className="gap-2">
        <Text className="text-white/60 text-xs">Días disponibles</Text>
        <View className="flex-row flex-wrap gap-2">
          {DAYS.map((day, index) => {
            const number = index + 1;
            const active = service.dias_disponibles.includes(number);
            return (
              <Pressable
                key={day.key}
                onPress={() => onToggleDay(number)}
                className={`px-3 py-1 rounded-full border ${
                  active ? 'border-mc-warn bg-mc-warn/20' : 'border-white/10 bg-white/5'
                }`}
              >
                <Text className="text-white text-xs font-semibold">{day.label.charAt(0)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Text className="text-white/60 text-xs mb-2">Hora inicio</Text>
          <Pressable
            onPress={() => onOpenPicker('hora_inicio', timeOptions, 'Hora inicio')}
            className={`${FIELD_STYLES} flex-row items-center justify-between`}
          >
            <Text className="text-white">{service.hora_inicio || 'Seleccionar'}</Text>
            <Ionicons name="time-outline" size={16} color="#E2E8F0" />
          </Pressable>
        </View>
        <View className="flex-1">
          <Text className="text-white/60 text-xs mb-2">Hora fin</Text>
          <Pressable
            onPress={() => onOpenPicker('hora_fin', timeOptions, 'Hora fin')}
            className={`${FIELD_STYLES} flex-row items-center justify-between`}
          >
            <Text className="text-white">{service.hora_fin || 'Seleccionar'}</Text>
            <Ionicons name="time-outline" size={16} color="#E2E8F0" />
          </Pressable>
        </View>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Text className="text-white/60 text-xs mb-2">Ambiente</Text>
          <Pressable
            onPress={() => onOpenPicker('ambiente', AMBIENTE_OPTIONS, 'Ambiente')}
            className={`${FIELD_STYLES} flex-row items-center justify-between`}
          >
            <Text className="text-white">
              {AMBIENTE_OPTIONS.find((option) => option.value === service.ambiente)?.label ||
                'Seleccionar'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#E2E8F0" />
          </Pressable>
        </View>
        <View className="flex-1">
          <Text className="text-white/60 text-xs mb-2">Precio</Text>
          <Pressable
            disabled={!priceEnabled}
            onPress={() => onOpenPicker('precio_tipo', PRECIO_TIPO_OPTIONS, 'Tipo de precio')}
            className={`${FIELD_STYLES} flex-row items-center justify-between ${
              priceEnabled ? '' : 'opacity-50'
            }`}
          >
            <Text className="text-white">
              {PRECIO_TIPO_OPTIONS.find((option) => option.value === service.precio_tipo)?.label ||
                (priceEnabled ? 'Seleccionar' : 'Solo reserva')}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#E2E8F0" />
          </Pressable>
        </View>
      </View>

      <TextInput
        value={service.precio_valor}
        onChangeText={(value) => onUpdate('precio_valor', value)}
        placeholder="Precio"
        placeholderTextColor="#94A3B8"
        keyboardType="numeric"
        editable={priceEnabled}
        className={`${FIELD_STYLES} ${priceEnabled ? '' : 'opacity-50'}`}
      />

      <View className="gap-2">
        <Text className="text-white/60 text-xs">Imagen</Text>
        <View className="flex-row gap-3">
          <TextInput
            value={service.imagen_url}
            onChangeText={(value) => onUpdate('imagen_url', value)}
            placeholder="URL o selector"
            placeholderTextColor="#94A3B8"
            className={`${FIELD_STYLES} flex-1`}
          />
          <Pressable
            onPress={onSelectImage}
            className="rounded-full border border-white/10 px-4 py-3"
          >
            <Ionicons name="image-outline" size={16} color="#F8FAFC" />
          </Pressable>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-white/60 text-xs">Iconos</Text>
        <View className="flex-row flex-wrap gap-2">
          {ICON_OPTIONS.map((option) => {
            const active = Boolean(service[option.key]);
            return (
              <Pressable
                key={option.key}
                onPress={() => onUpdate(option.key, !active)}
                className={`flex-row items-center gap-2 rounded-full px-3 py-2 border ${
                  active ? 'border-emerald-400 bg-emerald-500/20' : 'border-white/10 bg-white/5'
                }`}
              >
                <Ionicons name={option.icon} size={14} color="#F8FAFC" />
                <Text className="text-white text-xs font-semibold">{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-white/60 text-xs">Color</Text>
        <View className="flex-row flex-wrap gap-2">
          {SERVICE_COLORS.map((color) => {
            const selected = (normalizeHexColor(service.color) || fallbackColor) === color;
            return (
              <Pressable
                key={color}
                onPress={() => onUpdate('color', color)}
                className={`h-8 w-8 items-center justify-center rounded-full border ${
                  selected ? 'border-white' : 'border-white/20'
                }`}
                style={{ backgroundColor: color }}
                accessibilityLabel={`Seleccionar color ${color}`}
              >
                {selected ? <Ionicons name="checkmark" size={16} color="#F8FAFC" /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        onPress={() => onUpdate('activo', !service.activo)}
        className="self-start rounded-full border border-white/10 px-3 py-2"
      >
        <Text className="text-white text-xs font-semibold">
          {service.activo ? 'Pausar servicio' : 'Reactivar servicio'}
        </Text>
      </Pressable>
    </View>
  );
}

export default function ServiciosScreen() {
  const [services, setServices] = useState([]);
  const [editingService, setEditingService] = useState(null);
  const [editingServiceForm, setEditingServiceForm] = useState(buildServiceDefaults());
  const [showEditServicePanel, setShowEditServicePanel] = useState(false);
  const [pickerState, setPickerState] = useState(null);
  const [timeOptions, setTimeOptions] = useState(() => buildTimeOptions([]));
  const [loadingServices, setLoadingServices] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [showTypePanel, setShowTypePanel] = useState(false);
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const [showPaymentPanel, setShowPaymentPanel] = useState(false);
  const [showPromoPanel, setShowPromoPanel] = useState(false);
  const [showCouponPanel, setShowCouponPanel] = useState(false);
  const [showServicePanel, setShowServicePanel] = useState(false);
  const [showAllMembersPanel, setShowAllMembersPanel] = useState(false);
  const [typeForm, setTypeForm] = useState(buildMemberTypeForm());
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [memberTypes, setMemberTypes] = useState([]);
  const [members, setMembers] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]);
  const [memberForm, setMemberForm] = useState(buildMemberForm());
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState([]);
  const [memberSearchLoading, setMemberSearchLoading] = useState(false);
  const [memberSearchError, setMemberSearchError] = useState('');
  const [memberLoadError, setMemberLoadError] = useState('');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [paymentSearchResults, setPaymentSearchResults] = useState([]);
  const [paymentSearchLoading, setPaymentSearchLoading] = useState(false);
  const [paymentSearchError, setPaymentSearchError] = useState('');
  const [selectedPaymentMember, setSelectedPaymentMember] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [promoForm, setPromoForm] = useState(buildPromotionForm());
  const [promoDatePicker, setPromoDatePicker] = useState({ visible: false, field: null });
  const [couponForm, setCouponForm] = useState(buildCouponForm());
  const [courts, setCourts] = useState([]);
  const [newServiceForm, setNewServiceForm] = useState(buildServiceDefaults());
  const serviceLimitReached = services.length >= MAX_SERVICES;

  const displayedMembers = members.slice(0, 10);
  const hasMoreMembers = members.length > 10;

  const memberTotals = useMemo(() => {
    return members.reduce(
      (acc, member) => {
        acc.total += 1;
        const statusKey = member.estado_pago ?? 'pendiente';
        acc[statusKey] = (acc[statusKey] ?? 0) + 1;
        return acc;
      },
      { total: 0, pagado: 0, pendiente: 0, vencido: 0 },
    );
  }, [members]);

  const renderMemberCard = (member) => {
    const statusKey = (member.estado_pago || 'pendiente').toLowerCase();
    const statusLabel =
      statusKey === 'pagado' ? 'Pagado' : statusKey === 'vencido' ? 'Vencido' : 'Pendiente';

    return (
      <View
        key={member.asociado_id}
        className="rounded-2xl border border-white/10 bg-white/5 p-4"
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-white font-semibold">
              {member.nombre_completo || member.nombre}
            </Text>
            <Text className="text-white/60 text-xs mt-1">
              Plan {member.tipo_nombre || 'Sin asignar'}
            </Text>
            {member.telefono ? (
              <Text className="text-white/40 text-xs mt-1">{member.telefono}</Text>
            ) : null}
          </View>
          <View className={`rounded-full px-3 py-1 ${statusStyles[statusKey]}`}>
            <Text className="text-xs font-semibold">{statusLabel}</Text>
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2 mt-3">
          <Pressable
            onPress={() => handleDeleteMember(member.asociado_id)}
            className="rounded-full border border-rose-500/40 px-3 py-1"
          >
            <Text className="text-rose-200 text-xs font-semibold">Eliminar</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      const results = await Promise.allSettled([
        listClubServiceEntries(),
        getClubSchedule(),
        listMemberTypes(),
        listMembers(),
        getClubCourts(),
      ]);
      if (!mounted) return;

      const [
        servicesResult,
        scheduleResult,
        typesResult,
        membersResult,
        courtsResult,
      ] = results;

      if (servicesResult.status === 'fulfilled') {
        const normalized = Array.isArray(servicesResult.value)
          ? servicesResult.value.map((service) => normalizeServiceEntry(service))
          : [];
        setServices(normalized);
        setCatalogServices(normalized);
      } else {
        setServices([]);
        setCatalogServices([]);
        setErrorMessage(servicesResult.reason?.message || 'No pudimos cargar los servicios');
      }

      if (scheduleResult.status === 'fulfilled') {
        setTimeOptions(buildTimeOptions(scheduleResult.value));
      } else {
        setTimeOptions(buildTimeOptions([]));
      }

      if (typesResult.status === 'fulfilled') {
        setMemberTypes(
          Array.isArray(typesResult.value)
            ? typesResult.value.map((type) => normalizeMemberType(type)).filter(Boolean)
            : [],
        );
      } else {
        setMemberTypes([]);
      }

      if (membersResult.status === 'fulfilled') {
        setMembers(
          Array.isArray(membersResult.value)
            ? membersResult.value.map((member) => normalizeMember(member)).filter(Boolean)
            : [],
        );
        setMemberLoadError('');
      } else {
        setMembers([]);
        setMemberLoadError('No pudimos cargar asociados. Intentá más tarde.');
      }

      if (courtsResult.status === 'fulfilled') {
        setCourts(Array.isArray(courtsResult.value) ? courtsResult.value : []);
      } else {
        setCourts([]);
      }

      setLoadingServices(false);
    };
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const persistService = async (service) => {
    const payload = {
      nombre: service.nombre,
      modo_acceso: service.modo_acceso,
      dias_disponibles: service.dias_disponibles,
      hora_inicio: service.hora_inicio || null,
      hora_fin: service.hora_fin || null,
      imagen_url: service.imagen_url || null,
      color: service.color || null,
      ambiente: service.ambiente || null,
      precio_tipo: service.precio_tipo || null,
      precio_valor: service.precio_valor ? Number(service.precio_valor) : null,
      no_fumar: service.no_fumar,
      mas_18: service.mas_18,
      comida: service.comida,
      eco_friendly: service.eco_friendly,
      activo: service.activo,
    };

    if (service.servicio_id && !String(service.servicio_id).startsWith('tmp-')) {
      const { nombre, ...updatePayload } = payload;
      return updateClubServiceEntry(service.servicio_id, updatePayload);
    }
    return createClubServiceEntry(payload);
  };

  const handleToggleEdit = (id) => {
    const target = services.find((service) => service.servicio_id === id);
    if (!target) return;
    setEditingService(target);
    setEditingServiceForm({ ...buildServiceDefaults(), ...target });
    setShowEditServicePanel(true);
  };

  const handleCloseEditServicePanel = () => {
    setShowEditServicePanel(false);
    setEditingService(null);
    setEditingServiceForm(buildServiceDefaults());
  };

  const handleSaveEditService = async () => {
    try {
      setErrorMessage('');
      const saved = await persistService(editingServiceForm);
      const normalized = normalizeServiceEntry(saved);
      setServices((current) =>
        current.map((item) => {
          if (item.servicio_id === editingServiceForm.servicio_id) return normalized;
          return item;
        }),
      );
      setCatalogServices((current) =>
        current.map((item) => {
          if (item.servicio_id === editingServiceForm.servicio_id) return normalized;
          return item;
        }),
      );
      handleCloseEditServicePanel();
    } catch (err) {
      setErrorMessage(err?.message || 'No pudimos guardar el servicio');
    }
  };

  const handleAddService = () => {
    if (serviceLimitReached) {
      return;
    }
    setNewServiceForm(buildServiceDefaults());
    setShowServicePanel(true);
  };

  const handleDeleteService = async (serviceId) => {
    const target = services.find((service) => service.servicio_id === serviceId);
    if (!target) return;
    if (!target.servicio_id || String(target.servicio_id).startsWith('tmp-')) {
      setServices((prev) => prev.filter((service) => service.servicio_id !== serviceId));
      return;
    }
    try {
      await deleteClubServiceEntry(serviceId);
      setServices((prev) => prev.filter((service) => service.servicio_id !== serviceId));
    } catch (err) {
      setErrorMessage(err?.message || 'No pudimos eliminar el servicio');
    }
  };

  const handleDeleteEditingService = async () => {
    if (!editingServiceForm.servicio_id) return;
    await handleDeleteService(editingServiceForm.servicio_id);
    handleCloseEditServicePanel();
  };

  const handleOpenPicker = ({ context = 'editService', id, field, options, title }) => {
    setPickerState({ context, id, field, options, title });
  };

  const handleOpenPromoDatePicker = (field) => {
    if (Platform.OS === 'web') return;
    setPromoDatePicker({ visible: true, field });
  };

  const handlePromoDateChange = (event, selectedDate) => {
    if (!promoDatePicker.field) return;
    if (event?.type === 'dismissed') {
      setPromoDatePicker({ visible: false, field: null });
      return;
    }
    const nextDate = selectedDate ?? new Date();
    setPromoForm((prev) => ({
      ...prev,
      [promoDatePicker.field]: formatDateInput(nextDate),
    }));
    if (Platform.OS !== 'ios') {
      setPromoDatePicker({ visible: false, field: null });
    }
  };

  const softenServiceColor = (value, alpha = 0.32) => {
    const normalized = normalizeHexColor(value);
    if (!normalized) return value;
    let hex = normalized.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((char) => char + char)
        .join('');
    }
    const intValue = Number.parseInt(hex, 16);
    if (Number.isNaN(intValue)) return value;
    const red = (intValue >> 16) & 255;
    const green = (intValue >> 8) & 255;
    const blue = intValue & 255;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  };

  const resolveServiceColor = (service, index) => {
    const normalized = normalizeHexColor(service?.color);
    if (normalized) return normalized;
    return SERVICE_COLORS[index % SERVICE_COLORS.length];
  };

  const handleSelectPickerOption = (value) => {
    if (!pickerState) return;
    if (pickerState.context === 'editService') {
      setEditingServiceForm((prev) => ({ ...prev, [pickerState.field]: value }));
    } else if (pickerState.context === 'newService') {
      setNewServiceForm((prev) => ({ ...prev, [pickerState.field]: value }));
    } else if (pickerState.context === 'member') {
      setMemberForm((prev) => ({ ...prev, [pickerState.field]: value }));
    } else if (pickerState.context === 'type') {
      setTypeForm((prev) => ({ ...prev, [pickerState.field]: value }));
    } else if (pickerState.context === 'promo') {
      setPromoForm((prev) => ({ ...prev, [pickerState.field]: value }));
    } else if (pickerState.context === 'coupon') {
      setCouponForm((prev) => ({ ...prev, [pickerState.field]: value }));
    }
    setPickerState(null);
  };

  const handleSelectNewServiceImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setErrorMessage('Necesitamos permisos para acceder a tus fotos');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled) {
        const asset = result.assets?.[0];
        if (asset?.uri) {
          setNewServiceForm((prev) => ({ ...prev, imagen_url: asset.uri }));
        }
      }
    } catch (err) {
      setErrorMessage('No pudimos abrir el selector de imágenes');
    }
  };

  const handleSelectEditServiceImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setErrorMessage('Necesitamos permisos para acceder a tus fotos');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled) {
        const asset = result.assets?.[0];
        if (asset?.uri) {
          setEditingServiceForm((prev) => ({ ...prev, imagen_url: asset.uri }));
        }
      }
    } catch (err) {
      setErrorMessage('No pudimos abrir el selector de imágenes');
    }
  };

  const handleSaveNewService = async () => {
    try {
      setErrorMessage('');
      if (!newServiceForm.nombre.trim()) {
        setErrorMessage('El nombre del servicio es obligatorio.');
        return;
      }
      const saved = await persistService(newServiceForm);
      const normalized = normalizeServiceEntry(saved);
      setServices((prev) => [normalized, ...prev]);
      setCatalogServices((prev) => [normalized, ...prev]);
      setShowServicePanel(false);
      setNewServiceForm(buildServiceDefaults());
    } catch (err) {
      setErrorMessage(err?.message || 'No pudimos crear el servicio');
    }
  };

  const handleToggleServiceIncluded = (serviceId) => {
    setTypeForm((prev) => {
      const current = Array.isArray(prev.servicios_incluidos) ? prev.servicios_incluidos : [];
      if (current.includes(serviceId)) {
        return { ...prev, servicios_incluidos: current.filter((id) => id !== serviceId) };
      }
      return { ...prev, servicios_incluidos: [...current, serviceId] };
    });
  };

  const handleEditMemberType = (type) => {
    if (!type) return;
    setTypeForm({
      nombre: type.nombre || '',
      cuota_mensual: type.cuota_mensual !== null && type.cuota_mensual !== undefined
        ? String(type.cuota_mensual)
        : '',
      fecha_pago: type.fecha_pago !== null && type.fecha_pago !== undefined ? String(type.fecha_pago) : '',
      dias_gracia:
        type.dias_gracia !== null && type.dias_gracia !== undefined ? String(type.dias_gracia) : '',
      color: type.color || '#F97316',
      servicios_incluidos: Array.isArray(type.servicios_incluidos)
        ? type.servicios_incluidos.map((service) => service.servicio_id)
        : [],
    });
    setEditingTypeId(type.tipo_asociado_id);
    setShowTypePanel(true);
  };

  const handleSaveMemberType = async () => {
    try {
      setErrorMessage('');
      const nombre = typeForm.nombre.trim();
      if (!nombre) {
        setErrorMessage('El nombre del tipo de asociado es obligatorio.');
        return;
      }
      const cuota = Number(typeForm.cuota_mensual);
      const fechaPago = Number(typeForm.fecha_pago);
      const diasGracia = Number(typeForm.dias_gracia);
      if (!Number.isFinite(cuota) || cuota < 0) {
        setErrorMessage('Indicá una cuota mensual válida.');
        return;
      }
      if (!Number.isFinite(fechaPago) || fechaPago < 1 || fechaPago > 31) {
        setErrorMessage('Indicá un día de pago válido (1-31).');
        return;
      }
      if (!Number.isFinite(diasGracia) || diasGracia < 0) {
        setErrorMessage('Indicá días de gracia válidos.');
        return;
      }

      const payload = {
        nombre,
        cuota_mensual: cuota,
        fecha_pago: fechaPago,
        dias_gracia: diasGracia,
        color: typeForm.color || '#F97316',
        servicios_incluidos: typeForm.servicios_incluidos,
      };

      const saved = editingTypeId
        ? await updateMemberType(editingTypeId, payload)
        : await createMemberType(payload);
      const normalized = normalizeMemberType(saved);
      if (!normalized) return;
      setMemberTypes((prev) => {
        if (editingTypeId) {
          return prev.map((item) =>
            item.tipo_asociado_id === editingTypeId ? normalized : item
          );
        }
        return [normalized, ...prev];
      });
      setShowTypePanel(false);
      resetPanels();
    } catch (err) {
      setErrorMessage(err?.message || 'No pudimos guardar el tipo de asociado');
    }
  };

  const handleDeleteMemberType = async (tipoId) => {
    try {
      setErrorMessage('');
      await deleteMemberType(tipoId);
      setMemberTypes((prev) => prev.filter((item) => item.tipo_asociado_id !== tipoId));
    } catch (err) {
      setErrorMessage(err?.message || 'No pudimos eliminar el tipo de asociado');
    }
  };

  const handleSearchMembers = async () => {
    const term = memberSearchQuery.trim();
    if (term.length < 3) {
      setMemberSearchError('Ingresá al menos 3 caracteres para buscar.');
      return;
    }
    try {
      setMemberSearchLoading(true);
      setMemberSearchError('');
      const results = await searchPlayers(term, { limit: 8 });
      setMemberSearchResults(results);
    } catch (err) {
      setMemberSearchError(err?.message || 'No pudimos buscar usuarios');
    } finally {
      setMemberSearchLoading(false);
    }
  };

  const handleSelectExistingUser = (user) => {
    if (!user) return;
    setMemberForm((prev) => ({
      ...prev,
      usuario_id: user.id,
      nombre: user.nombre || '',
      apellido: user.apellido || '',
      telefono: user.telefono || prev.telefono,
    }));
  };

  const handleSearchPaymentMembers = async () => {
    const term = paymentSearchQuery.trim();
    if (term.length < 2) {
      setPaymentSearchError('Ingresá al menos 2 caracteres para buscar.');
      return;
    }
    try {
      setPaymentSearchLoading(true);
      setPaymentSearchError('');
      const results = await searchMembers(term, { limit: 8 });
      const normalized = Array.isArray(results)
        ? results.map((member) => normalizeMember(member)).filter(Boolean)
        : [];
      setPaymentSearchResults(normalized);
    } catch (err) {
      setPaymentSearchError(err?.message || 'No pudimos buscar asociados');
    } finally {
      setPaymentSearchLoading(false);
    }
  };

  const handleSelectPaymentMember = (member) => {
    if (!member) return;
    setSelectedPaymentMember(member);
    setPaymentAmount('');
  };

  const handleProcessPayment = () => {
    if (!selectedPaymentMember) {
      setPaymentSearchError('Seleccioná un asociado primero.');
      return;
    }
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentSearchError('Ingresá un monto válido.');
      return;
    }

    Alert.alert(
      'Confirmar pago',
      `¿Querés registrar un pago de $${amount.toFixed(2)} para ${selectedPaymentMember.nombre_completo}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              setPaymentProcessing(true);
              setPaymentSearchError('');
              const updated = await registerMemberPayment(
                selectedPaymentMember.asociado_id,
                { monto: amount }
              );
              const normalized = normalizeMember(updated);
              if (normalized) {
                setMembers((prev) => {
                  const exists = prev.some(
                    (item) => item.asociado_id === normalized.asociado_id
                  );
                  if (!exists) return [normalized, ...prev];
                  return prev.map((item) =>
                    item.asociado_id === normalized.asociado_id ? normalized : item
                  );
                });
                setSelectedPaymentMember(normalized);
              }
              setPaymentAmount('');
            } catch (err) {
              setPaymentSearchError(err?.message || 'No pudimos procesar el pago');
            } finally {
              setPaymentProcessing(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleTogglePromoCourt = (courtId) => {
    if (!courtId) return;
    setPromoForm((prev) => {
      const normalized = String(courtId);
      const selected = new Set(prev.canchas_aplicadas.map((item) => String(item)));
      if (selected.has(normalized)) {
        selected.delete(normalized);
      } else {
        selected.add(normalized);
      }
      return { ...prev, canchas_aplicadas: Array.from(selected) };
    });
  };

  const handleSavePromotion = async () => {
    try {
      setErrorMessage('');
      if (!promoForm.nombre.trim()) {
        setErrorMessage('Ingresá el nombre de la promoción.');
        return;
      }
      if (!isValidDate(promoForm.fecha_inicio) || !isValidTime(promoForm.hora_inicio)) {
        setErrorMessage('Ingresá una fecha/hora de inicio válida.');
        return;
      }
      if (!isValidDate(promoForm.fecha_fin) || !isValidTime(promoForm.hora_fin)) {
        setErrorMessage('Ingresá una fecha/hora de fin válida.');
        return;
      }
      if (!DISCOUNT_TYPE_OPTIONS.some((option) => option.value === promoForm.tipo_descuento)) {
        setErrorMessage('Seleccioná el tipo de descuento.');
        return;
      }
      const valor = Number(promoForm.valor);
      if (!Number.isFinite(valor) || valor <= 0) {
        setErrorMessage('Ingresá un valor de descuento válido.');
        return;
      }

      const fechaInicio = buildDateTimePayload(promoForm.fecha_inicio, promoForm.hora_inicio);
      const fechaFin = buildDateTimePayload(promoForm.fecha_fin, promoForm.hora_fin);
      const startDate = new Date(fechaInicio?.replace(' ', 'T') || '');
      const endDate = new Date(fechaFin?.replace(' ', 'T') || '');

      if (!fechaInicio || !fechaFin || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        setErrorMessage('Las fechas ingresadas no son válidas.');
        return;
      }
      if (startDate >= endDate) {
        setErrorMessage('La fecha de fin debe ser posterior al inicio.');
        return;
      }

      await createPromotion({
        nombre: promoForm.nombre.trim(),
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tipo_descuento: promoForm.tipo_descuento,
        valor,
        canchas_aplicadas: promoForm.canchas_aplicadas.map((id) => Number(id)).filter(Boolean),
      });

      setPromoForm(buildPromotionForm());
      setShowPromoPanel(false);
    } catch (err) {
      setErrorMessage(err?.message || 'No pudimos crear la promoción');
    }
  };

  const handleSaveCoupon = async () => {
    try {
      setErrorMessage('');
      if (!couponForm.nombre.trim()) {
        setErrorMessage('Ingresá el nombre del cupón.');
        return;
      }
      const usosPermitidos = Number.parseInt(couponForm.usos_permitidos, 10);
      if (!Number.isInteger(usosPermitidos) || usosPermitidos <= 0) {
        setErrorMessage('Ingresá un número válido de usos permitidos.');
        return;
      }
      if (!DISCOUNT_TYPE_OPTIONS.some((option) => option.value === couponForm.tipo_descuento)) {
        setErrorMessage('Seleccioná el tipo de descuento del cupón.');
        return;
      }
      const valor = Number(couponForm.valor);
      if (!Number.isFinite(valor) || valor <= 0) {
        setErrorMessage('Ingresá un valor de descuento válido.');
        return;
      }

      await createCoupon({
        nombre: couponForm.nombre.trim(),
        usos_permitidos: usosPermitidos,
        tipo_descuento: couponForm.tipo_descuento,
        valor,
      });

      setCouponForm(buildCouponForm());
      setShowCouponPanel(false);
    } catch (err) {
      setErrorMessage(err?.message || 'No pudimos crear el cupón');
    }
  };

  const handleSaveMember = async () => {
    try {
      setErrorMessage('');
      if (!memberForm.tipo_asociado_id) {
        setErrorMessage('Seleccioná un tipo de asociado.');
        return;
      }
      const telefono = memberForm.telefono.trim();
      if (!telefono) {
        setErrorMessage('El teléfono es obligatorio.');
        return;
      }

      const payload = {
        tipo_asociado_id: memberForm.tipo_asociado_id,
        usuario_id: memberForm.usuario_id || undefined,
        nombre: memberForm.nombre || undefined,
        apellido: memberForm.apellido || undefined,
        dni: memberForm.dni || undefined,
        telefono,
        direccion: memberForm.direccion || undefined,
        correo: memberForm.correo || undefined,
      };

      const saved = await createMember(payload);
      const normalized = normalizeMember(saved);
      if (!normalized) return;
      setMembers((prev) => [normalized, ...prev]);
      setShowMemberPanel(false);
      resetPanels();
    } catch (err) {
      setErrorMessage(err?.message || 'No pudimos crear el asociado');
    }
  };

  const handleDeleteMember = async (asociadoId) => {
    try {
      setErrorMessage('');
      await deleteMember(asociadoId);
      setMembers((prev) => prev.filter((item) => item.asociado_id !== asociadoId));
    } catch (err) {
      setErrorMessage(err?.message || 'No pudimos eliminar el asociado');
    }
  };

  const resetPanels = () => {
    setTypeForm(buildMemberTypeForm());
    setEditingTypeId(null);
    setPromoForm(buildPromotionForm());
    setPromoDatePicker({ visible: false, field: null });
    setCouponForm(buildCouponForm());
    setMemberForm(buildMemberForm());
    setMemberSearchQuery('');
    setMemberSearchResults([]);
    setMemberSearchError('');
    setPaymentSearchQuery('');
    setPaymentSearchResults([]);
    setPaymentSearchError('');
    setSelectedPaymentMember(null);
    setPaymentAmount('');
    setPaymentSearchLoading(false);
    setPaymentProcessing(false);
  };

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      <ScreenHeader
        title="Servicios y Asociados"
        subtitle="Centralizá la configuración de tus servicios y el seguimiento de asociados."
      />

      <View className="flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <View className="grid grid-cols-3 gap-3">
          <ActionButton
            onPress={() => setShowPaymentPanel(true)}
            icon="cash-outline"
            label="Cargar pago de cuota"
            backgroundClassName="bg-emerald-400 hover:bg-emerald-400/80"
          />
          <ActionButton
            onPress={() => setShowPromoPanel(true)}
            icon="sparkles-outline"
            label="Crear promoción"
            backgroundClassName="bg-emerald-400 hover:bg-emerald-400/80"
          />
          <ActionButton
            onPress={() => setShowCouponPanel(true)}
            icon="ticket-outline"
            label="Crear cupón de descuento"
            backgroundClassName="bg-emerald-400 hover:bg-emerald-400/80"
          />
          <ActionButton
            onPress={handleAddService}
            disabled={serviceLimitReached}
            icon="add-circle-outline"
            label="Nuevo servicio"
          />
          <ActionButton
            onPress={() => {
              setTypeForm(buildMemberTypeForm());
              setEditingTypeId(null);
              setShowTypePanel(true);
            }}
            icon="people-outline"
            label="Crear plan de asociado"
          />
          <ActionButton
            onPress={() => setShowMemberPanel(true)}
            icon="person-add-outline"
            label="Alta de asociado"
          />
        </View>
      </View>
      <View className="mt-4 gap-3">
        {errorMessage ? (
          <View className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
            <Text className="text-rose-100 text-sm">{errorMessage}</Text>
          </View>
        ) : null}
        {serviceLimitReached ? (
          <View className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3">
            <Text className="text-amber-100 text-sm">
              Alcanzaste el máximo de {MAX_SERVICES} servicios. Eliminá uno para crear otro.
            </Text>
          </View>
        ) : null}
      </View>

      <View className="gap-6 lg:flex-row">
        <View className="flex-1 gap-6">
          <Card className="gap-4 pb-6">
            <CardTitle colorClass="text-mc-info">Configuración de servicios</CardTitle>
            <Text className="text-white/60">
              Editá cada servicio con detalle, definí duraciones y mantené el catálogo actualizado.
            </Text>
            <View className="flex-row flex-wrap gap-4">
              <View className="flex-1 min-w-[140px]">
                <Text className="text-white text-xs">Servicios activos</Text>
                <Text className="text-emerald-300 text-xl font-semibold">
                  {services.filter((service) => service.activo).length}
                </Text>
              </View>
              <View className="flex-1 min-w-[140px]">
                <Text className="text-white text-xs">Servicios pausados</Text>
                <Text className="text-amber-300 text-xl font-semibold">
                  {services.filter((service) => !service.activo).length}
                </Text>
              </View>
            </View>
            <View className="mt-6 gap-5">
              {loadingServices ? (
                <Card className="items-center py-6">
                  <Text className="text-white/70">Cargando servicios...</Text>
                </Card>
              ) : (
                services.map((service, index) => {
                  const baseColor = resolveServiceColor(service, index);
                  const cardColor = softenServiceColor(baseColor);
                  return (
                    <View key={service.servicio_id} className="gap-2">
                      <ServiceCard
                        service={service}
                        cardColor={cardColor}
                        onToggleEdit={handleToggleEdit}
                      />
                    </View>
                  );
                })
              )}
            </View>
          </Card>
        </View>

        <View className="flex-1 gap-6">
            <Card className="gap-4">
              <CardTitle colorClass="text-mc-warn">Planes de asociados</CardTitle>
              <Text className="text-white/60">
                Definí planes para socios, cuotas mensuales y beneficios incluidos.
              </Text>
              <View className="gap-4">
                {memberTypes.length ? (
                  memberTypes.map((type) => {
                    const servicesLabel = type.servicios_incluidos.length
                      ? type.servicios_incluidos.map((service) => service.nombre).join(', ')
                      : 'Sin servicios incluidos';
                    return (
                      <View
                        key={type.tipo_asociado_id}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                      >
                        <View className="flex-row items-start justify-between gap-3">
                          <View className="flex-1 gap-1">
                            <View className="flex-row items-center gap-2">
                              <View
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: type.color || '#F97316' }}
                              />
                              <Text className="text-white font-semibold text-base">{type.nombre}</Text>
                            </View>
                            <Text className="text-white/60 text-xs">
                              {servicesLabel}
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-2">
                            <Pressable
                              onPress={() => handleEditMemberType(type)}
                              className="rounded-full border border-white/10 px-3 py-1"
                            >
                              <Text className="text-white text-xs font-semibold">Editar</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => handleDeleteMemberType(type.tipo_asociado_id)}
                              className="rounded-full border border-rose-500/40 px-3 py-1"
                            >
                              <Text className="text-rose-200 text-xs font-semibold">Eliminar</Text>
                            </Pressable>
                          </View>
                        </View>
                        <View className="flex-row flex-wrap items-center justify-between mt-3 gap-2">
                          <Text className="text-white text-lg font-semibold">
                            ${type.cuota_mensual ?? 0} / mes
                          </Text>
                          <Text className="text-white/60 text-xs">
                            Pago día {type.fecha_pago ?? '--'} · Gracia {type.dias_gracia ?? 0} días
                          </Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <Text className="text-white/70 text-sm">
                      Aún no hay tipos de asociados. Creá el primero para habilitar altas.
                    </Text>
                  </View>
                )}
              </View>
            </Card>

            <Card className="gap-4">
              <View className="flex-row items-center justify-between gap-3">
                <CardTitle colorClass="text-mc-purpleAccent">Asociados</CardTitle>
                {hasMoreMembers ? (
                  <Pressable
                    onPress={() => setShowAllMembersPanel(true)}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2"
                  >
                    <Text className="text-white text-xs font-semibold">Ver todos</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text className="text-white/60">
                Seguimiento rápido de pagos, altas y bajas de la membresía.
              </Text>
              {memberLoadError ? (
                <View className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2">
                  <Text className="text-rose-100 text-xs">{memberLoadError}</Text>
                </View>
              ) : null}
              <View className="flex-row flex-wrap gap-4">
                <View className="flex-1 min-w-[120px]">
                  <Text className="text-white/60 text-xs">Total</Text>
                  <Text className="text-white text-xl font-semibold">{memberTotals.total}</Text>
                </View>
                <View className="flex-1 min-w-[120px]">
                  <Text className="text-white/60 text-xs">Pagados</Text>
                  <Text className="text-white text-xl font-semibold">{memberTotals.pagado}</Text>
                </View>
                <View className="flex-1 min-w-[120px]">
                  <Text className="text-white/60 text-xs">Pendientes</Text>
                  <Text className="text-white text-xl font-semibold">{memberTotals.pendiente}</Text>
                </View>
              </View>
              <View className="gap-3">
                {displayedMembers.length ? (
                  displayedMembers.map((member) => renderMemberCard(member))
                ) : (
                  <View className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <Text className="text-white/70 text-sm">
                      No hay asociados registrados todavía.
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          </View>
        </View>
      </ScrollView>

      <ActionPanel
        visible={showServicePanel}
        title="Nuevo servicio"
        subtitle="Cargá la información base antes de publicarlo."
        onClose={() => {
          setShowServicePanel(false);
          setNewServiceForm(buildServiceDefaults());
        }}
      >
        <ServiceForm
          service={newServiceForm}
          fallbackColor={SERVICE_COLORS[0]}
          priceEnabled={newServiceForm.modo_acceso === 'reserva'}
          onUpdate={(key, value) => setNewServiceForm((prev) => ({ ...prev, [key]: value }))}
          onToggleDay={(dayNumber) =>
            setNewServiceForm((prev) => {
              const exists = prev.dias_disponibles.includes(dayNumber);
              const updated = exists
                ? prev.dias_disponibles.filter((day) => day !== dayNumber)
                : [...prev.dias_disponibles, dayNumber];
              return { ...prev, dias_disponibles: updated };
            })
          }
          onOpenPicker={(field, options, title) =>
            handleOpenPicker({
              context: 'newService',
              field,
              options,
              title,
            })
          }
          onSelectImage={handleSelectNewServiceImage}
          timeOptions={timeOptions}
        />
        <Pressable
          onPress={handleSaveNewService}
          className="rounded-full bg-mc-primary px-4 py-3 items-center"
        >
          <Text className="text-white font-semibold">Crear servicio</Text>
        </Pressable>
      </ActionPanel>

      <ActionPanel
        visible={showEditServicePanel}
        title={editingService?.nombre ? `Editar ${editingService.nombre}` : 'Editar servicio'}
        subtitle="Actualizá la información del servicio."
        onClose={handleCloseEditServicePanel}
      >
        <ServiceForm
          service={editingServiceForm}
          fallbackColor={SERVICE_COLORS[0]}
          priceEnabled={editingServiceForm.modo_acceso === 'reserva'}
          showNameField={false}
          onUpdate={(key, value) => setEditingServiceForm((prev) => ({ ...prev, [key]: value }))}
          onToggleDay={(dayNumber) =>
            setEditingServiceForm((prev) => {
              const exists = prev.dias_disponibles.includes(dayNumber);
              const updated = exists
                ? prev.dias_disponibles.filter((day) => day !== dayNumber)
                : [...prev.dias_disponibles, dayNumber];
              return { ...prev, dias_disponibles: updated };
            })
          }
          onOpenPicker={(field, options, title) =>
            handleOpenPicker({
              context: 'editService',
              field,
              options,
              title,
            })
          }
          onSelectImage={handleSelectEditServiceImage}
          timeOptions={timeOptions}
        />
        <View className="flex-row flex-wrap gap-3">
          <Pressable
            onPress={handleCloseEditServicePanel}
            className="rounded-full border border-white/10 px-4 py-3 items-center"
          >
            <Text className="text-white font-semibold">Cancelar</Text>
          </Pressable>
          <Pressable
            onPress={handleSaveEditService}
            className="rounded-full bg-mc-primary px-4 py-3 items-center"
          >
            <Text className="text-white font-semibold">Guardar cambios</Text>
          </Pressable>
          {editingServiceForm.servicio_id ? (
            <Pressable
              onPress={handleDeleteEditingService}
              className="rounded-full border border-rose-500/40 px-4 py-3 items-center"
            >
              <Text className="text-rose-200 font-semibold">Eliminar servicio</Text>
            </Pressable>
          ) : null}
        </View>
      </ActionPanel>

      <ActionPanel
        visible={showTypePanel}
        title={editingTypeId ? 'Editar plan de asociado' : 'Crear plan de asociado'}
        subtitle="Sumá nuevos planes con beneficios específicos."
        onClose={() => {
          setShowTypePanel(false);
          resetPanels();
        }}
      >
        <TextInput
          value={typeForm.nombre}
          onChangeText={(value) => setTypeForm((prev) => ({ ...prev, nombre: value }))}
          placeholder="Nombre del plan"
          placeholderTextColor="#94A3B8"
          className={FIELD_STYLES}
        />
        <View className="flex-row gap-3">
          <TextInput
            value={typeForm.cuota_mensual}
            onChangeText={(value) => setTypeForm((prev) => ({ ...prev, cuota_mensual: value }))}
            placeholder="Cuota mensual"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            className={`${FIELD_STYLES} flex-1`}
          />
          <TextInput
            value={typeForm.fecha_pago}
            onChangeText={(value) => setTypeForm((prev) => ({ ...prev, fecha_pago: value }))}
            placeholder="Día de pago (1-31)"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            className={`${FIELD_STYLES} flex-1`}
          />
        </View>
        <View className="flex-row gap-3">
          <TextInput
            value={typeForm.dias_gracia}
            onChangeText={(value) => setTypeForm((prev) => ({ ...prev, dias_gracia: value }))}
            placeholder="Días de gracia"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            className={`${FIELD_STYLES} flex-1`}
          />
          <TextInput
            value={typeForm.color}
            onChangeText={(value) => setTypeForm((prev) => ({ ...prev, color: value }))}
            placeholder="Color (hex)"
            placeholderTextColor="#94A3B8"
            className={`${FIELD_STYLES} flex-1`}
          />
        </View>
        <View className="gap-2">
          <Text className="text-white/60 text-xs">Servicios incluidos</Text>
          <View className="flex-row flex-wrap gap-2">
            {catalogServices.length ? (
              catalogServices.map((service) => {
                const active = typeForm.servicios_incluidos.includes(service.servicio_id);
                return (
                  <Pressable
                    key={service.servicio_id}
                    onPress={() => handleToggleServiceIncluded(service.servicio_id)}
                    className={`rounded-full border px-3 py-2 ${
                      active ? 'border-mc-warn bg-mc-warn/20' : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <Text className="text-white text-xs font-semibold">{service.nombre}</Text>
                  </Pressable>
                );
              })
            ) : (
              <Text className="text-white/50 text-xs">
                Cargá servicios en tu club para poder incluirlos en el plan.
              </Text>
            )}
          </View>
        </View>
        <Pressable
          onPress={handleSaveMemberType}
          className="rounded-full bg-mc-primary px-4 py-3 items-center"
        >
          <Text className="text-white font-semibold">
            {editingTypeId ? 'Guardar cambios' : 'Guardar tipo de asociado'}
          </Text>
        </Pressable>
      </ActionPanel>

      <ActionPanel
        visible={showMemberPanel}
        title="Alta de asociado"
        subtitle="Copiá datos desde un usuario existente o creá uno nuevo."
        onClose={() => {
          setShowMemberPanel(false);
          resetPanels();
        }}
      >
        <View className="gap-2">
          <Text className="text-white/60 text-xs">Copiar desde usuarios existentes</Text>
          <View className="flex-row gap-2">
            <TextInput
              value={memberSearchQuery}
              onChangeText={(value) => setMemberSearchQuery(value)}
              placeholder="Buscar por teléfono, nombre o email"
              placeholderTextColor="#94A3B8"
              className={`${FIELD_STYLES} flex-1`}
            />
            <Pressable
              onPress={handleSearchMembers}
              className="rounded-full border border-white/10 px-4 py-3"
            >
              <Ionicons name="search-outline" size={16} color="#F8FAFC" />
            </Pressable>
          </View>
          {memberSearchError ? (
            <Text className="text-rose-200 text-xs">{memberSearchError}</Text>
          ) : null}
          {memberSearchLoading ? (
            <Text className="text-white/60 text-xs">Buscando usuarios...</Text>
          ) : null}
          {memberSearchResults.length ? (
            <View className="gap-2">
              {memberSearchResults.map((user) => (
                <Pressable
                  key={user.id}
                  onPress={() => handleSelectExistingUser(user)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <Text className="text-white text-sm font-semibold">
                    {user.nombreCompleto || `${user.nombre} ${user.apellido}`.trim()}
                  </Text>
                  {user.telefono ? (
                    <Text className="text-white/50 text-xs">{user.telefono}</Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}
          {memberForm.usuario_id ? (
            <View className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              <Text className="text-emerald-100 text-xs">
                Usuario seleccionado: {memberForm.nombre} {memberForm.apellido}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="gap-2">
          <Text className="text-white/60 text-xs">Tipo de asociado</Text>
          <Pressable
            onPress={() =>
              handleOpenPicker({
                context: 'member',
                field: 'tipo_asociado_id',
                options: memberTypes.map((type) => ({
                  value: type.tipo_asociado_id,
                  label: type.nombre,
                })),
                title: 'Seleccionar tipo',
              })
            }
            className={`${FIELD_STYLES} flex-row items-center justify-between`}
          >
            <Text className="text-white">
              {memberTypes.find((type) => type.tipo_asociado_id === memberForm.tipo_asociado_id)
                ?.nombre || 'Seleccionar'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#E2E8F0" />
          </Pressable>
        </View>

        <View className="flex-row gap-3">
          <TextInput
            value={memberForm.nombre}
            onChangeText={(value) => setMemberForm((prev) => ({ ...prev, nombre: value }))}
            placeholder="Nombre"
            placeholderTextColor="#94A3B8"
            className={`${FIELD_STYLES} flex-1`}
          />
          <TextInput
            value={memberForm.apellido}
            onChangeText={(value) => setMemberForm((prev) => ({ ...prev, apellido: value }))}
            placeholder="Apellido"
            placeholderTextColor="#94A3B8"
            className={`${FIELD_STYLES} flex-1`}
          />
        </View>
        <View className="flex-row gap-3">
          <TextInput
            value={memberForm.dni}
            onChangeText={(value) => setMemberForm((prev) => ({ ...prev, dni: value }))}
            placeholder="DNI"
            placeholderTextColor="#94A3B8"
            className={`${FIELD_STYLES} flex-1`}
          />
          <TextInput
            value={memberForm.telefono}
            onChangeText={(value) => setMemberForm((prev) => ({ ...prev, telefono: value }))}
            placeholder="Teléfono"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
            className={`${FIELD_STYLES} flex-1`}
          />
        </View>
        <TextInput
          value={memberForm.direccion}
          onChangeText={(value) => setMemberForm((prev) => ({ ...prev, direccion: value }))}
          placeholder="Dirección"
          placeholderTextColor="#94A3B8"
          className={FIELD_STYLES}
        />
        <TextInput
          value={memberForm.correo}
          onChangeText={(value) => setMemberForm((prev) => ({ ...prev, correo: value }))}
          placeholder="Correo electrónico"
          placeholderTextColor="#94A3B8"
          keyboardType="email-address"
          className={FIELD_STYLES}
        />
        <Pressable
          onPress={handleSaveMember}
          className="rounded-full bg-mc-primary px-4 py-3 items-center"
        >
          <Text className="text-white font-semibold">Guardar asociado</Text>
        </Pressable>
      </ActionPanel>

      <ActionPanel
        visible={showPaymentPanel}
        title="Cargar pago"
        subtitle="Buscá un asociado y registrá el monto abonado."
        onClose={() => {
          setShowPaymentPanel(false);
          resetPanels();
        }}
      >
        <View className="gap-2">
          <Text className="text-white/60 text-xs">Buscar asociado</Text>
          <View className="flex-row gap-2">
            <TextInput
              value={paymentSearchQuery}
              onChangeText={(value) => setPaymentSearchQuery(value)}
              placeholder="Buscar por nombre, apellido o teléfono"
              placeholderTextColor="#94A3B8"
              className={`${FIELD_STYLES} flex-1`}
            />
            <Pressable
              onPress={handleSearchPaymentMembers}
              className="rounded-full border border-white/10 px-4 py-3"
            >
              <Ionicons name="search-outline" size={16} color="#F8FAFC" />
            </Pressable>
          </View>
          {paymentSearchError ? (
            <Text className="text-rose-200 text-xs">{paymentSearchError}</Text>
          ) : null}
          {paymentSearchLoading ? (
            <Text className="text-white/60 text-xs">Buscando asociados...</Text>
          ) : null}
          {paymentSearchResults.length ? (
            <View className="gap-2">
              {paymentSearchResults.map((member) => {
                const isSelected =
                  selectedPaymentMember?.asociado_id === member.asociado_id;
                return (
                  <Pressable
                    key={member.asociado_id}
                    onPress={() => handleSelectPaymentMember(member)}
                    className={`rounded-xl border px-3 py-2 ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-500/10'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <Text className="text-white text-sm font-semibold">
                      {member.nombre_completo || member.nombre}
                    </Text>
                    <Text className="text-white/50 text-xs">
                      {member.tipo_nombre || 'Sin tipo asignado'}
                    </Text>
                    {member.telefono ? (
                      <Text className="text-white/50 text-xs">{member.telefono}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        {selectedPaymentMember ? (
          <View className="rounded-2xl border border-white/10 bg-white/5 p-4 gap-2">
            <Text className="text-white font-semibold">
              {selectedPaymentMember.nombre_completo || selectedPaymentMember.nombre}
            </Text>
            <Text className="text-white/60 text-xs">
              Tipo: {selectedPaymentMember.tipo_nombre || 'Sin asignar'}
            </Text>
            <View className="flex-row flex-wrap justify-between gap-2">
              <Text className="text-white/70 text-xs">
                Cuota mensual: ${selectedPaymentMember.cuota_mensual ?? 0}
              </Text>
              <Text className="text-white/70 text-xs">
                Deuda actual: $
                {(
                  selectedPaymentMember.deuda ?? calculateDebt(selectedPaymentMember)
                ).toFixed(2)}
              </Text>
            </View>
          </View>
        ) : null}

        <View className="gap-2">
          <Text className="text-white/60 text-xs">Monto a pagar</Text>
          <TextInput
            value={paymentAmount}
            onChangeText={(value) => setPaymentAmount(value)}
            placeholder="Ingresar monto"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            className={FIELD_STYLES}
          />
        </View>
        <Pressable
          onPress={handleProcessPayment}
          disabled={paymentProcessing}
          className={`rounded-full px-4 py-3 items-center ${
            paymentProcessing ? 'bg-white/10' : 'bg-mc-primary'
          }`}
        >
          <Text className="text-white font-semibold">
            {paymentProcessing ? 'Procesando...' : 'Procesar pago'}
          </Text>
        </Pressable>
      </ActionPanel>

      <ActionPanel
        visible={showPromoPanel}
        title="Crear promoción"
        subtitle="Generá campañas especiales para atraer asociados."
        onClose={() => {
          setShowPromoPanel(false);
          resetPanels();
        }}
      >
        <TextInput
          value={promoForm.nombre}
          onChangeText={(value) => setPromoForm((prev) => ({ ...prev, nombre: value }))}
          placeholder="Nombre de la promoción"
          placeholderTextColor="#94A3B8"
          className={FIELD_STYLES}
        />
        <View className="flex-row gap-3">
          {Platform.OS === 'web' ? (
            <TextInput
              value={promoForm.fecha_inicio}
              onChangeText={(value) => setPromoForm((prev) => ({ ...prev, fecha_inicio: value }))}
              placeholder="Fecha inicio (YYYY-MM-DD)"
              placeholderTextColor="#94A3B8"
              type="date"
              className={`${FIELD_STYLES} flex-1`}
            />
          ) : (
            <Pressable
              onPress={() => handleOpenPromoDatePicker('fecha_inicio')}
              className={`${FIELD_STYLES} flex-1 justify-center`}
            >
              <Text className={promoForm.fecha_inicio ? 'text-white' : 'text-white/50'}>
                {promoForm.fecha_inicio || 'Fecha inicio'}
              </Text>
            </Pressable>
          )}
          <TextInput
            value={promoForm.hora_inicio}
            onChangeText={(value) => setPromoForm((prev) => ({ ...prev, hora_inicio: value }))}
            placeholder="Hora inicio (HH:MM)"
            placeholderTextColor="#94A3B8"
            className={`${FIELD_STYLES} flex-1`}
          />
        </View>
        <View className="flex-row gap-3">
          {Platform.OS === 'web' ? (
            <TextInput
              value={promoForm.fecha_fin}
              onChangeText={(value) => setPromoForm((prev) => ({ ...prev, fecha_fin: value }))}
              placeholder="Fecha fin (YYYY-MM-DD)"
              placeholderTextColor="#94A3B8"
              type="date"
              className={`${FIELD_STYLES} flex-1`}
            />
          ) : (
            <Pressable
              onPress={() => handleOpenPromoDatePicker('fecha_fin')}
              className={`${FIELD_STYLES} flex-1 justify-center`}
            >
              <Text className={promoForm.fecha_fin ? 'text-white' : 'text-white/50'}>
                {promoForm.fecha_fin || 'Fecha fin'}
              </Text>
            </Pressable>
          )}
          <TextInput
            value={promoForm.hora_fin}
            onChangeText={(value) => setPromoForm((prev) => ({ ...prev, hora_fin: value }))}
            placeholder="Hora fin (HH:MM)"
            placeholderTextColor="#94A3B8"
            className={`${FIELD_STYLES} flex-1`}
          />
        </View>
        {promoDatePicker.visible && Platform.OS !== 'web' ? (
          <DateTimePicker
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
            value={
              parseDateInput(promoForm[promoDatePicker.field]) ?? new Date()
            }
            onChange={handlePromoDateChange}
          />
        ) : null}
        <Pressable
          onPress={() =>
            handleOpenPicker({
              context: 'promo',
              field: 'tipo_descuento',
              options: DISCOUNT_TYPE_OPTIONS,
              title: 'Tipo de descuento',
            })
          }
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
        >
          <Text className="text-white text-sm">
            {DISCOUNT_TYPE_OPTIONS.find((option) => option.value === promoForm.tipo_descuento)
              ?.label || 'Seleccioná tipo de descuento'}
          </Text>
        </Pressable>
        <TextInput
          value={promoForm.valor}
          onChangeText={(value) => setPromoForm((prev) => ({ ...prev, valor: value }))}
          placeholder="Valor del descuento"
          placeholderTextColor="#94A3B8"
          keyboardType="numeric"
          className={FIELD_STYLES}
        />
        <View className="gap-2">
          <Text className="text-white/60 text-xs">Canchas aplicadas</Text>
          {courts.length ? (
            <View className="flex-row flex-wrap gap-2">
              {courts.map((court) => {
                const courtId = court.cancha_id ?? court.id;
                const isSelected = promoForm.canchas_aplicadas.some(
                  (item) => String(item) === String(courtId)
                );
                return (
                  <Pressable
                    key={courtId}
                    onPress={() => handleTogglePromoCourt(courtId)}
                    className={`rounded-full px-3 py-2 border ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-500/10'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <Text className="text-white text-xs">
                      {court.nombre ?? `Cancha ${courtId}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text className="text-white/50 text-xs">
              No encontramos canchas cargadas.
            </Text>
          )}
          {!promoForm.canchas_aplicadas.length ? (
            <Text className="text-white/50 text-xs">
              Si no seleccionás canchas, la promoción aplicará a todas.
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={handleSavePromotion}
          className="rounded-full bg-mc-primary px-4 py-3 items-center"
        >
          <Text className="text-white font-semibold">Publicar promoción</Text>
        </Pressable>
      </ActionPanel>

      <ActionPanel
        visible={showCouponPanel}
        title="Crear cupón de descuento"
        subtitle="Administrá códigos y disponibilidad de descuentos."
        onClose={() => {
          setShowCouponPanel(false);
          resetPanels();
        }}
      >
        <TextInput
          value={couponForm.nombre}
          onChangeText={(value) => setCouponForm((prev) => ({ ...prev, nombre: value }))}
          placeholder="Nombre o código del cupón"
          placeholderTextColor="#94A3B8"
          className={FIELD_STYLES}
        />
        <TextInput
          value={couponForm.usos_permitidos}
          onChangeText={(value) => setCouponForm((prev) => ({ ...prev, usos_permitidos: value }))}
          placeholder="Usos permitidos"
          placeholderTextColor="#94A3B8"
          keyboardType="numeric"
          className={FIELD_STYLES}
        />
        <Pressable
          onPress={() =>
            handleOpenPicker({
              context: 'coupon',
              field: 'tipo_descuento',
              options: DISCOUNT_TYPE_OPTIONS,
              title: 'Tipo de descuento',
            })
          }
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
        >
          <Text className="text-white text-sm">
            {DISCOUNT_TYPE_OPTIONS.find((option) => option.value === couponForm.tipo_descuento)
              ?.label || 'Seleccioná tipo de descuento'}
          </Text>
        </Pressable>
        <TextInput
          value={couponForm.valor}
          onChangeText={(value) => setCouponForm((prev) => ({ ...prev, valor: value }))}
          placeholder="Valor del descuento"
          placeholderTextColor="#94A3B8"
          keyboardType="numeric"
          className={FIELD_STYLES}
        />
        <Pressable
          onPress={handleSaveCoupon}
          className="rounded-full bg-mc-primary px-4 py-3 items-center"
        >
          <Text className="text-white font-semibold">Publicar cupón</Text>
        </Pressable>
      </ActionPanel>

      <ActionPanel
        visible={showAllMembersPanel}
        title="Asociados"
        subtitle="Listado completo de asociados."
        onClose={() => setShowAllMembersPanel(false)}
      >
        {members.length ? (
          <ScrollView className="max-h-[60vh]" showsVerticalScrollIndicator={false}>
            <View className="gap-3 pb-2">{members.map((member) => renderMemberCard(member))}</View>
          </ScrollView>
        ) : (
          <View className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <Text className="text-white/70 text-sm">No hay asociados registrados todavía.</Text>
          </View>
        )}
      </ActionPanel>

      <ActionPanel
        visible={Boolean(pickerState)}
        title={pickerState?.title}
        onClose={() => setPickerState(null)}
      >
        <ScrollView className="max-h-[360px]" contentContainerClassName="gap-2 pb-2">
          {pickerState?.options?.map((option) => {
            const value = option.value ?? option.id ?? option.key ?? option;
            const label = option.label ?? option.nombre ?? option.title ?? String(option);
            return (
              <Pressable
                key={value}
                onPress={() => handleSelectPickerOption(value)}
                className="rounded-xl px-4 py-3 border border-white/5 bg-white/5"
              >
                <Text className="text-white text-base font-medium">{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </ActionPanel>
    </ScrollView>
  );
}
