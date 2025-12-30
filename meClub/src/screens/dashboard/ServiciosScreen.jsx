import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/Card';
import CardTitle from '../../components/CardTitle';
import {
  createClubServiceEntry,
  deleteClubServiceEntry,
  listClubServiceEntries,
  updateClubServiceEntry,
  getClubSchedule,
} from '../../lib/api';
import { DAYS, normalizeSchedule, normalizeTimeToHHMM } from './configurationState';

const FIELD_STYLES =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-mc-warn';

const ACTION_BUTTON_STYLES =
  'flex-row items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2';

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
];

const ICON_OPTIONS = [
  { key: 'no_fumar', label: 'No fumar', icon: 'ban-outline' },
  { key: 'mas_18', label: '+18', icon: 'alert-circle-outline' },
  { key: 'comida', label: 'Comida', icon: 'restaurant-outline' },
  { key: 'eco_friendly', label: 'Eco', icon: 'leaf-outline' },
];

const MEMBER_TYPES = [
  {
    id: 'type-1',
    name: 'Pleno',
    price: '35000',
    access: 'Acceso total + canchas preferenciales',
    active: true,
  },
  {
    id: 'type-2',
    name: 'Familiar',
    price: '52000',
    access: 'Hasta 4 miembros + beneficios compartidos',
    active: true,
  },
  {
    id: 'type-3',
    name: 'Social',
    price: '18000',
    access: 'Acceso limitado + eventos',
    active: false,
  },
];

const MEMBERS = [
  {
    id: 'mem-1',
    name: 'Lucía Fernández',
    type: 'Pleno',
    status: 'Pagado',
  },
  {
    id: 'mem-2',
    name: 'Carlos Méndez',
    type: 'Familiar',
    status: 'Pendiente',
  },
  {
    id: 'mem-3',
    name: 'Paula Ríos',
    type: 'Social',
    status: 'Vencido',
  },
];

const statusStyles = {
  Pagado: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30',
  Pendiente: 'bg-amber-500/15 text-amber-200 border border-amber-500/30',
  Vencido: 'bg-rose-500/15 text-rose-200 border border-rose-500/30',
};

const buildPanelState = () => ({
  name: '',
  description: '',
  discount: '',
  validity: '',
});

function ActionPanel({ visible, title, subtitle, onClose, children }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="rounded-t-3xl bg-[#0F172A] px-6 pb-8 pt-5 shadow-card">
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
          <View className="mt-6 gap-4">{children}</View>
        </View>
      </View>
    </Modal>
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
  ambiente: '',
  precio_tipo: '',
  precio_valor: '',
  no_fumar: false,
  mas_18: false,
  comida: false,
  eco_friendly: false,
  activo: true,
});

const normalizeServiceEntry = (service) => {
  if (!service || typeof service !== 'object') return buildServiceDefaults();
  return {
    ...buildServiceDefaults(),
    ...service,
    nombre: service.nombre ?? service.name ?? '',
    modo_acceso: service.modo_acceso ?? 'libre',
    dias_disponibles: Array.isArray(service.dias_disponibles)
      ? service.dias_disponibles.map((day) => Number(day)).filter((day) => day >= 1 && day <= 7)
      : [],
    hora_inicio: normalizeTimeToHHMM(service.hora_inicio) || '',
    hora_fin: normalizeTimeToHHMM(service.hora_fin) || '',
    imagen_url: service.imagen_url ?? '',
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

function ServiceCard({
  service,
  onToggleEdit,
  onUpdate,
  onToggleDay,
  onOpenPicker,
  onSelectImage,
  isEditing,
  timeOptions,
}) {
  const priceEnabled = service.modo_acceso === 'reserva';
  return (
    <Card className="gap-4">
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
            <Ionicons name={isEditing ? 'checkmark' : 'pencil'} size={14} color="#F8FAFC" />
            <Text className="text-white text-xs font-semibold">
              {isEditing ? 'Listo' : 'Editar'}
            </Text>
          </Pressable>
          <View
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              service.activo ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-white/50'
            }`}
          >
            <Text className="text-xs font-semibold">{service.activo ? 'Activo' : 'Pausado'}</Text>
          </View>
        </View>
      </View>

      {isEditing ? (
        <View className="gap-3">
          <TextInput
            value={service.nombre}
            onChangeText={(value) => onUpdate(service.servicio_id, 'nombre', value)}
            placeholder="Nombre del servicio"
            placeholderTextColor="#94A3B8"
            className={FIELD_STYLES}
          />
          <View className="gap-2">
            <Text className="text-white/60 text-xs">Modo de acceso</Text>
            <Pressable
              onPress={() =>
                onOpenPicker(service.servicio_id, 'modo_acceso', MODE_ACCESS_OPTIONS, 'Modo de acceso')
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
                    onPress={() => onToggleDay(service.servicio_id, number)}
                    className={`px-3 py-1 rounded-full border ${
                      active ? 'border-mc-warn bg-mc-warn/20' : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <Text className="text-white text-xs font-semibold">
                      {day.label.charAt(0)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-white/60 text-xs mb-2">Hora inicio</Text>
              <Pressable
                onPress={() =>
                  onOpenPicker(service.servicio_id, 'hora_inicio', timeOptions, 'Hora inicio')
                }
                className={`${FIELD_STYLES} flex-row items-center justify-between`}
              >
                <Text className="text-white">{service.hora_inicio || 'Seleccionar'}</Text>
                <Ionicons name="time-outline" size={16} color="#E2E8F0" />
              </Pressable>
            </View>
            <View className="flex-1">
              <Text className="text-white/60 text-xs mb-2">Hora fin</Text>
              <Pressable
                onPress={() =>
                  onOpenPicker(service.servicio_id, 'hora_fin', timeOptions, 'Hora fin')
                }
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
                onPress={() =>
                  onOpenPicker(service.servicio_id, 'ambiente', AMBIENTE_OPTIONS, 'Ambiente')
                }
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
                onPress={() =>
                  onOpenPicker(service.servicio_id, 'precio_tipo', PRECIO_TIPO_OPTIONS, 'Tipo de precio')
                }
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
            onChangeText={(value) => onUpdate(service.servicio_id, 'precio_valor', value)}
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
                onChangeText={(value) => onUpdate(service.servicio_id, 'imagen_url', value)}
                placeholder="URL o selector"
                placeholderTextColor="#94A3B8"
                className={`${FIELD_STYLES} flex-1`}
              />
              <Pressable
                onPress={() => onSelectImage(service.servicio_id)}
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
                    onPress={() => onUpdate(service.servicio_id, option.key, !active)}
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

          <Pressable
            onPress={() => onUpdate(service.servicio_id, 'activo', !service.activo)}
            className="self-start rounded-full border border-white/10 px-3 py-2"
          >
            <Text className="text-white text-xs font-semibold">
              {service.activo ? 'Pausar servicio' : 'Reactivar servicio'}
            </Text>
          </Pressable>
        </View>
      ) : (
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
      )}
    </Card>
  );
}

export default function ServiciosScreen() {
  const [services, setServices] = useState([]);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [pickerState, setPickerState] = useState(null);
  const [timeOptions, setTimeOptions] = useState(() => buildTimeOptions([]));
  const [loadingServices, setLoadingServices] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [showTypePanel, setShowTypePanel] = useState(false);
  const [showPromoPanel, setShowPromoPanel] = useState(false);
  const [showCouponPanel, setShowCouponPanel] = useState(false);
  const [typeForm, setTypeForm] = useState(buildPanelState());
  const [promoForm, setPromoForm] = useState(buildPanelState());
  const [couponForm, setCouponForm] = useState(buildPanelState());

  const memberTotals = useMemo(() => {
    return MEMBERS.reduce(
      (acc, member) => {
        acc.total += 1;
        acc[member.status] = (acc[member.status] ?? 0) + 1;
        return acc;
      },
      { total: 0, Pagado: 0, Pendiente: 0, Vencido: 0 },
    );
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const [servicesResponse, scheduleResponse] = await Promise.all([
          listClubServiceEntries(),
          getClubSchedule(),
        ]);
        if (!mounted) return;
        const normalized = Array.isArray(servicesResponse)
          ? servicesResponse.map((service) => normalizeServiceEntry(service))
          : [];
        setServices(normalized);
        setTimeOptions(buildTimeOptions(scheduleResponse));
      } catch (err) {
        if (!mounted) return;
        setErrorMessage(err?.message || 'No pudimos cargar los servicios');
      } finally {
        if (mounted) setLoadingServices(false);
      }
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
      return updateClubServiceEntry(service.servicio_id, payload);
    }
    return createClubServiceEntry(payload);
  };

  const handleServiceUpdate = (id, key, value) => {
    setServices((prev) =>
      prev.map((service) =>
        service.servicio_id === id
          ? {
              ...service,
              [key]: value,
            }
          : service,
      ),
    );
  };

  const handleToggleEdit = (id) => {
    setEditingServiceId((prev) => (prev === id ? null : id));
    const target = services.find((service) => service.servicio_id === id);
    if (editingServiceId === id && target) {
      persistService(target)
        .then((saved) => {
          const normalized = normalizeServiceEntry(saved);
          setServices((current) =>
            current.map((item) => {
              if (item.servicio_id === id) return normalized;
              return item;
            }),
          );
        })
        .catch((err) => {
          setErrorMessage(err?.message || 'No pudimos guardar el servicio');
        });
    }
  };

  const handleAddService = () => {
    const tempId = `tmp-${Date.now()}`;
    const draft = { ...buildServiceDefaults(), servicio_id: tempId };
    setServices((prev) => [draft, ...prev]);
    setEditingServiceId(tempId);
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

  const handleToggleDay = (serviceId, dayNumber) => {
    setServices((prev) =>
      prev.map((service) => {
        if (service.servicio_id !== serviceId) return service;
        const exists = service.dias_disponibles.includes(dayNumber);
        const updated = exists
          ? service.dias_disponibles.filter((day) => day !== dayNumber)
          : [...service.dias_disponibles, dayNumber];
        return { ...service, dias_disponibles: updated };
      }),
    );
  };

  const handleOpenPicker = (serviceId, field, options, title) => {
    setPickerState({ serviceId, field, options, title });
  };

  const handleSelectPickerOption = (value) => {
    if (!pickerState) return;
    handleServiceUpdate(pickerState.serviceId, pickerState.field, value);
    setPickerState(null);
  };

  const handleSelectImage = async (serviceId) => {
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
          handleServiceUpdate(serviceId, 'imagen_url', asset.uri);
        }
      }
    } catch (err) {
      setErrorMessage('No pudimos abrir el selector de imágenes');
    }
  };

  const resetPanels = () => {
    setTypeForm(buildPanelState());
    setPromoForm(buildPanelState());
    setCouponForm(buildPanelState());
  };

  return (
    <View className="flex-1 bg-mc-bg">
      <ScrollView contentContainerClassName="px-6 pb-12">
        <View className="py-6 gap-4">
          <View className="flex-row flex-wrap items-center justify-between gap-3">
            <Text className="text-white text-[28px] font-extrabold tracking-tight">
              Servicios y asociados
            </Text>
            <View className="flex-row flex-wrap items-center gap-3">
              <Pressable onPress={handleAddService} className={ACTION_BUTTON_STYLES}>
                <Ionicons name="add-circle-outline" size={16} color="#F8FAFC" />
                <Text className="text-white text-sm font-semibold">Nuevo servicio</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowTypePanel(true)}
                className={ACTION_BUTTON_STYLES}
              >
                <Ionicons name="people-outline" size={16} color="#F8FAFC" />
                <Text className="text-white text-sm font-semibold">Crear tipo de asociado</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowPromoPanel(true)}
                className={ACTION_BUTTON_STYLES}
              >
                <Ionicons name="sparkles-outline" size={16} color="#F8FAFC" />
                <Text className="text-white text-sm font-semibold">Crear promoción</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowCouponPanel(true)}
                className={ACTION_BUTTON_STYLES}
              >
                <Ionicons name="ticket-outline" size={16} color="#F8FAFC" />
                <Text className="text-white text-sm font-semibold">Crear cupón de descuento</Text>
              </Pressable>
            </View>
          </View>
          <Text className="text-white/60 max-w-3xl">
            Centralizá la configuración de servicios y el seguimiento de asociados. Ajustá precios,
            editá descripciones y administrá promociones sin salir del panel.
          </Text>
          {errorMessage ? (
            <View className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
              <Text className="text-rose-100 text-sm">{errorMessage}</Text>
            </View>
          ) : null}
        </View>

        <View className="gap-6 lg:flex-row">
          <View className="flex-1 gap-6">
            <Card className="gap-4">
              <CardTitle colorClass="text-mc-info">Configuración de servicios</CardTitle>
              <Text className="text-white/60">
                Editá cada servicio con detalle, definí duraciones y mantené el catálogo actualizado.
              </Text>
              <View className="flex-row flex-wrap gap-4">
                <View className="flex-1 min-w-[140px]">
                  <Text className="text-white/60 text-xs">Servicios activos</Text>
                  <Text className="text-white text-xl font-semibold">
                    {services.filter((service) => service.activo).length}
                  </Text>
                </View>
                <View className="flex-1 min-w-[140px]">
                  <Text className="text-white/60 text-xs">Servicios pausados</Text>
                  <Text className="text-white text-xl font-semibold">
                    {services.filter((service) => !service.activo).length}
                  </Text>
                </View>
              </View>
            </Card>

            <View className="gap-5">
              {loadingServices ? (
                <Card className="items-center py-6">
                  <Text className="text-white/70">Cargando servicios...</Text>
                </Card>
              ) : (
                services.map((service) => (
                  <View key={service.servicio_id} className="gap-2">
                    <ServiceCard
                      service={service}
                      onToggleEdit={handleToggleEdit}
                      onUpdate={handleServiceUpdate}
                      onToggleDay={handleToggleDay}
                      onOpenPicker={handleOpenPicker}
                      onSelectImage={handleSelectImage}
                      isEditing={editingServiceId === service.servicio_id}
                      timeOptions={timeOptions}
                    />
                    {editingServiceId === service.servicio_id ? (
                      <Pressable
                        onPress={() => handleDeleteService(service.servicio_id)}
                        className="self-end rounded-full border border-rose-500/40 px-3 py-2"
                      >
                        <Text className="text-rose-200 text-xs font-semibold">Eliminar</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </View>

          <View className="flex-1 gap-6">
            <Card className="gap-4">
              <CardTitle colorClass="text-mc-warn">Tipos de asociados</CardTitle>
              <Text className="text-white/60">
                Definí planes para socios, cuotas mensuales y beneficios incluidos.
              </Text>
              <View className="gap-4">
                {MEMBER_TYPES.map((type) => (
                  <View
                    key={type.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-white font-semibold text-base">{type.name}</Text>
                        <Text className="text-white/60 mt-1">{type.access}</Text>
                      </View>
                      <View
                        className={`rounded-full px-3 py-1 ${
                          type.active ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-white/50'
                        }`}
                      >
                        <Text className="text-xs font-semibold">
                          {type.active ? 'Activo' : 'Inactivo'}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-center justify-between mt-3">
                      <Text className="text-white text-lg font-semibold">${type.price} / mes</Text>
                      <Pressable className="rounded-full border border-white/10 px-3 py-1">
                        <Text className="text-white text-xs font-semibold">Editar</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </Card>

            <Card className="gap-4">
              <CardTitle colorClass="text-mc-purpleAccent">Asociados</CardTitle>
              <Text className="text-white/60">
                Seguimiento rápido de pagos, altas y bajas de la membresía.
              </Text>
              <View className="flex-row flex-wrap gap-4">
                <View className="flex-1 min-w-[120px]">
                  <Text className="text-white/60 text-xs">Total</Text>
                  <Text className="text-white text-xl font-semibold">{memberTotals.total}</Text>
                </View>
                <View className="flex-1 min-w-[120px]">
                  <Text className="text-white/60 text-xs">Pagados</Text>
                  <Text className="text-white text-xl font-semibold">{memberTotals.Pagado}</Text>
                </View>
                <View className="flex-1 min-w-[120px]">
                  <Text className="text-white/60 text-xs">Pendientes</Text>
                  <Text className="text-white text-xl font-semibold">{memberTotals.Pendiente}</Text>
                </View>
              </View>
              <View className="gap-3">
                {MEMBERS.map((member) => (
                  <View
                    key={member.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-white font-semibold">{member.name}</Text>
                        <Text className="text-white/60 text-xs mt-1">Plan {member.type}</Text>
                      </View>
                      <View className={`rounded-full px-3 py-1 ${statusStyles[member.status]}`}>
                        <Text className="text-xs font-semibold">{member.status}</Text>
                      </View>
                    </View>
                    <View className="flex-row flex-wrap gap-2 mt-3">
                      <Pressable className="rounded-full border border-white/10 px-3 py-1">
                        <Text className="text-white text-xs font-semibold">Marcar pago</Text>
                      </Pressable>
                      <Pressable className="rounded-full border border-white/10 px-3 py-1">
                        <Text className="text-white text-xs font-semibold">Suspender</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        </View>
      </ScrollView>

      <ActionPanel
        visible={showTypePanel}
        title="Crear tipo de asociado"
        subtitle="Sumá nuevos planes con beneficios específicos."
        onClose={() => {
          setShowTypePanel(false);
          resetPanels();
        }}
      >
        <TextInput
          value={typeForm.name}
          onChangeText={(value) => setTypeForm((prev) => ({ ...prev, name: value }))}
          placeholder="Nombre del plan"
          placeholderTextColor="#94A3B8"
          className={FIELD_STYLES}
        />
        <TextInput
          value={typeForm.description}
          onChangeText={(value) => setTypeForm((prev) => ({ ...prev, description: value }))}
          placeholder="Beneficios incluidos"
          placeholderTextColor="#94A3B8"
          className={`${FIELD_STYLES} min-h-[96px]`}
          multiline
        />
        <TextInput
          value={typeForm.discount}
          onChangeText={(value) => setTypeForm((prev) => ({ ...prev, discount: value }))}
          placeholder="Cuota mensual"
          placeholderTextColor="#94A3B8"
          keyboardType="numeric"
          className={FIELD_STYLES}
        />
        <Pressable className="rounded-full bg-mc-primary px-4 py-3 items-center">
          <Text className="text-white font-semibold">Guardar tipo de asociado</Text>
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
          value={promoForm.name}
          onChangeText={(value) => setPromoForm((prev) => ({ ...prev, name: value }))}
          placeholder="Nombre de la promoción"
          placeholderTextColor="#94A3B8"
          className={FIELD_STYLES}
        />
        <TextInput
          value={promoForm.description}
          onChangeText={(value) => setPromoForm((prev) => ({ ...prev, description: value }))}
          placeholder="Detalle o beneficio"
          placeholderTextColor="#94A3B8"
          className={`${FIELD_STYLES} min-h-[96px]`}
          multiline
        />
        <View className="flex-row gap-3">
          <TextInput
            value={promoForm.discount}
            onChangeText={(value) => setPromoForm((prev) => ({ ...prev, discount: value }))}
            placeholder="Descuento"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            className={`${FIELD_STYLES} flex-1`}
          />
          <TextInput
            value={promoForm.validity}
            onChangeText={(value) => setPromoForm((prev) => ({ ...prev, validity: value }))}
            placeholder="Vigencia"
            placeholderTextColor="#94A3B8"
            className={`${FIELD_STYLES} flex-1`}
          />
        </View>
        <Pressable className="rounded-full bg-mc-primary px-4 py-3 items-center">
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
          value={couponForm.name}
          onChangeText={(value) => setCouponForm((prev) => ({ ...prev, name: value }))}
          placeholder="Código del cupón"
          placeholderTextColor="#94A3B8"
          className={FIELD_STYLES}
        />
        <TextInput
          value={couponForm.description}
          onChangeText={(value) => setCouponForm((prev) => ({ ...prev, description: value }))}
          placeholder="Detalle del beneficio"
          placeholderTextColor="#94A3B8"
          className={`${FIELD_STYLES} min-h-[96px]`}
          multiline
        />
        <View className="flex-row gap-3">
          <TextInput
            value={couponForm.discount}
            onChangeText={(value) => setCouponForm((prev) => ({ ...prev, discount: value }))}
            placeholder="Descuento"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            className={`${FIELD_STYLES} flex-1`}
          />
          <TextInput
            value={couponForm.validity}
            onChangeText={(value) => setCouponForm((prev) => ({ ...prev, validity: value }))}
            placeholder="Vigencia"
            placeholderTextColor="#94A3B8"
            className={`${FIELD_STYLES} flex-1`}
          />
        </View>
        <Pressable className="rounded-full bg-mc-primary px-4 py-3 items-center">
          <Text className="text-white font-semibold">Publicar cupón</Text>
        </Pressable>
      </ActionPanel>

      {pickerState ? (
        <View className="absolute inset-0 bg-black/50 items-center justify-center px-4">
          <Card className="w-full max-w-xl max-h-[480px]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white text-lg font-semibold">{pickerState.title}</Text>
              <Pressable
                onPress={() => setPickerState(null)}
                className="h-9 w-9 items-center justify-center rounded-full bg-white/5"
              >
                <Ionicons name="close" size={18} color="white" />
              </Pressable>
            </View>
            <ScrollView className="max-h-[360px]" contentContainerClassName="pb-2">
              {pickerState.options.map((option) => {
                const value = option.value ?? option.id ?? option.key ?? option;
                const label = option.label ?? option.nombre ?? option.title ?? String(option);
                return (
                  <Pressable
                    key={value}
                    onPress={() => handleSelectPickerOption(value)}
                    className="rounded-xl px-4 py-3 mb-2 border border-white/5 bg-white/5"
                  >
                    <Text className="text-white text-base font-medium">{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Card>
        </View>
      ) : null}
    </View>
  );
}
