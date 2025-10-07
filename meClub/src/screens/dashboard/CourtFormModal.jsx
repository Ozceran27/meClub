import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Card from '../../components/Card';
import { resolveAssetUrl } from '../../lib/api';

const FIELD_STYLES =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-mc-warn';

const DEFAULT_VALUES = {
  nombre: '',
  deporte_id: null,
  capacidad: '',
  precio: '',
  precio_dia: '',
  precio_noche: '',
  tipo_suelo: '',
  techada: false,
  iluminacion: false,
  estado: 'disponible',
  imagen_url: null,
};

const ESTADOS = [
  { value: 'disponible', label: 'Disponible' },
  { value: 'mantenimiento', label: 'En mantenimiento' },
  { value: 'inactiva', label: 'Inactiva' },
];

function useInitialFormValues(initialValues) {
  return useMemo(() => {
    if (!initialValues || typeof initialValues !== 'object') {
      return DEFAULT_VALUES;
    }
    return {
      ...DEFAULT_VALUES,
      ...initialValues,
      capacidad:
        initialValues.capacidad === null || initialValues.capacidad === undefined
          ? ''
          : String(initialValues.capacidad),
      precio:
        initialValues.precio === null || initialValues.precio === undefined
          ? ''
          : String(initialValues.precio),
      precio_dia:
        initialValues.precio_dia === null || initialValues.precio_dia === undefined
          ? ''
          : String(initialValues.precio_dia),
      precio_noche:
        initialValues.precio_noche === null || initialValues.precio_noche === undefined
          ? ''
          : String(initialValues.precio_noche),
      tipo_suelo: initialValues.tipo_suelo || '',
      deporte_id: initialValues.deporte_id ?? null,
      estado: initialValues.estado || 'disponible',
    };
  }, [initialValues]);
}

export default function CourtFormModal({
  visible,
  onDismiss,
  onSubmit,
  initialValues,
  loading,
  title,
  sports = [],
  errorMessage,
}) {
  const [form, setForm] = useState(DEFAULT_VALUES);
  const [errors, setErrors] = useState({});
  const [imageAsset, setImageAsset] = useState(null);
  const [imageError, setImageError] = useState('');
  const [pickingImage, setPickingImage] = useState(false);
  const [showSportPicker, setShowSportPicker] = useState(false);

  const parsedInitialValues = useInitialFormValues(initialValues);

  useEffect(() => {
    if (!visible) return;
    setForm(parsedInitialValues);
    setErrors({});
    setImageAsset(null);
    setImageError('');
    setShowSportPicker(false);
  }, [visible, parsedInitialValues]);

  const previewUri = useMemo(() => {
    if (imageAsset?.uri) return imageAsset.uri;
    if (form?.imagen_url) return resolveAssetUrl(form.imagen_url);
    if (initialValues?.imagen_url) return resolveAssetUrl(initialValues.imagen_url);
    return null;
  }, [imageAsset?.uri, form?.imagen_url, initialValues?.imagen_url]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleBoolean = (key) => {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.nombre || !String(form.nombre).trim()) {
      nextErrors.nombre = 'Ingresá un nombre';
    }
    if (!form.deporte_id) {
      nextErrors.deporte_id = 'Seleccioná un deporte';
    }
    if (form.capacidad === '' || form.capacidad === null) {
      nextErrors.capacidad = 'Indicá la capacidad';
    } else if (Number.isNaN(Number(form.capacidad))) {
      nextErrors.capacidad = 'Capacidad inválida';
    }
    if (form.precio === '' || form.precio === null) {
      nextErrors.precio = 'Indicá el precio base';
    } else if (Number.isNaN(Number(form.precio))) {
      nextErrors.precio = 'Precio inválido';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const normalizeDecimal = (value) => {
    if (value === '' || value === null || value === undefined) {
      return null;
    }
    const sanitized = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    const num = typeof sanitized === 'number' ? sanitized : Number(sanitized);
    if (!Number.isFinite(num)) return null;
    return Number(num.toFixed(2));
  };

  const normalizeInteger = (value) => {
    if (value === '' || value === null || value === undefined) {
      return null;
    }
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.max(0, Math.trunc(num));
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const payload = {
      nombre: String(form.nombre).trim(),
      deporte_id: form.deporte_id ? Number(form.deporte_id) : null,
      capacidad: normalizeInteger(form.capacidad),
      precio: normalizeDecimal(form.precio),
      precio_dia: normalizeDecimal(form.precio_dia),
      precio_noche: normalizeDecimal(form.precio_noche),
      tipo_suelo: form.tipo_suelo ? String(form.tipo_suelo).trim() : null,
      techada: !!form.techada,
      iluminacion: !!form.iluminacion,
      estado: form.estado || 'disponible',
    };

    onSubmit?.({ values: payload, image: imageAsset });
  };

  const ensurePermissions = async () => {
    if (Platform.OS === 'web') {
      return true;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setImageError('Necesitamos permisos para acceder a tus imágenes');
      return false;
    }
    return true;
  };

  const handlePickImage = async () => {
    try {
      setPickingImage(true);
      setImageError('');
      const allowed = await ensurePermissions();
      if (!allowed) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: Platform.OS !== 'web',
      });
      if (!result.canceled && Array.isArray(result.assets) && result.assets.length > 0) {
        setImageAsset(result.assets[0]);
      }
    } catch (err) {
      setImageError(err?.message || 'No pudimos seleccionar la imagen');
    } finally {
      setPickingImage(false);
    }
  };

  const renderSportPicker = () => {
    if (!showSportPicker) return null;
    return (
      <View className="absolute inset-0 bg-black/50 items-center justify-center px-4">
        <Card className="w-full max-w-xl max-h-[480px]">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-white text-lg font-semibold">Seleccioná un deporte</Text>
            <Pressable
              onPress={() => setShowSportPicker(false)}
              className="h-9 w-9 items-center justify-center rounded-full bg-white/5"
            >
              <Ionicons name="close" size={18} color="white" />
            </Pressable>
          </View>
          <ScrollView className="max-h-[360px]" contentContainerClassName="pb-2">
            {(sports || []).map((sport) => (
              <Pressable
                key={sport.deporte_id || sport.id || sport.nombre}
                onPress={() => {
                  setForm((prev) => ({
                    ...prev,
                    deporte_id: sport.deporte_id ?? sport.id,
                  }));
                  setShowSportPicker(false);
                }}
                className={`rounded-xl px-4 py-3 mb-2 border border-white/5 ${
                  String(form.deporte_id) === String(sport.deporte_id ?? sport.id)
                    ? 'bg-white/10 border-mc-warn'
                    : 'bg-white/5'
                }`}
              >
                <Text className="text-white text-base font-medium">{sport.nombre}</Text>
                {sport.descripcion ? (
                  <Text className="text-white/60 text-sm mt-1">{sport.descripcion}</Text>
                ) : null}
              </Pressable>
            ))}
            {(sports || []).length === 0 && (
              <Text className="text-white/60 text-sm text-center">
                No encontramos deportes disponibles
              </Text>
            )}
          </ScrollView>
        </Card>
      </View>
    );
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={() => {
        if (!loading) {
          onDismiss?.();
        }
      }}
    >
      <View className="flex-1 bg-black/60 items-center justify-center px-4">
        <Card className="w-full max-w-3xl max-h-[90vh]">
          <View className="flex-row items-center justify-between mb-6">
            <View>
              <Text className="text-white text-2xl font-bold tracking-tight">{title}</Text>
              <Text className="text-white/60 text-sm mt-1">
                Completá los datos obligatorios marcados con *
              </Text>
            </View>
            <Pressable
              onPress={() => {
                if (!loading) onDismiss?.();
              }}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/5"
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          {errorMessage ? (
            <View className="mb-4 rounded-2xl border border-white/10 bg-[#2F1B1B]/80 px-4 py-3">
              <Text className="text-[#FCA5A5] text-sm">{errorMessage}</Text>
            </View>
          ) : null}

          <ScrollView className="flex-1" contentContainerClassName="pb-6">
            <View className="gap-4">
              <View>
                <Text className="text-white/70 text-sm mb-2">Nombre *</Text>
                <TextInput
                  value={form.nombre}
                  onChangeText={(text) => handleChange('nombre', text)}
                  placeholder="Cancha 1"
                  placeholderTextColor="#94A3B8"
                  className={FIELD_STYLES}
                />
                {errors.nombre ? (
                  <Text className="text-mc-warn text-xs mt-1">{errors.nombre}</Text>
                ) : null}
              </View>

              <View>
                <Text className="text-white/70 text-sm mb-2">Deporte *</Text>
                <Pressable
                  onPress={() => setShowSportPicker(true)}
                  className={`${FIELD_STYLES} flex-row items-center justify-between`}
                >
                  <Text className="text-white/90 text-base">
                    {sports?.find((sport) => String(sport.deporte_id ?? sport.id) === String(form.deporte_id))?.nombre ||
                      'Seleccioná un deporte'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                </Pressable>
                {errors.deporte_id ? (
                  <Text className="text-mc-warn text-xs mt-1">{errors.deporte_id}</Text>
                ) : null}
              </View>

              <View className="flex-row flex-wrap gap-4">
                <View className="flex-1 min-w-[140px]">
                  <Text className="text-white/70 text-sm mb-2">Capacidad *</Text>
                  <TextInput
                    value={form.capacidad}
                    onChangeText={(text) => handleChange('capacidad', text.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    placeholder="4"
                    placeholderTextColor="#94A3B8"
                    className={FIELD_STYLES}
                  />
                  {errors.capacidad ? (
                    <Text className="text-mc-warn text-xs mt-1">{errors.capacidad}</Text>
                  ) : null}
                </View>
                <View className="flex-1 min-w-[180px]">
                  <Text className="text-white/70 text-sm mb-2">Precio base *</Text>
                  <TextInput
                    value={form.precio}
                    onChangeText={(text) => handleChange('precio', text.replace(/[^0-9.,]/g, ''))}
                    keyboardType="decimal-pad"
                    placeholder="2500"
                    placeholderTextColor="#94A3B8"
                    className={FIELD_STYLES}
                  />
                  {errors.precio ? (
                    <Text className="text-mc-warn text-xs mt-1">{errors.precio}</Text>
                  ) : null}
                </View>
              </View>

              <View className="flex-row flex-wrap gap-4">
                <View className="flex-1 min-w-[180px]">
                  <Text className="text-white/70 text-sm mb-2">Precio turno día</Text>
                  <TextInput
                    value={form.precio_dia}
                    onChangeText={(text) => handleChange('precio_dia', text.replace(/[^0-9.,]/g, ''))}
                    keyboardType="decimal-pad"
                    placeholder="2300"
                    placeholderTextColor="#94A3B8"
                    className={FIELD_STYLES}
                  />
                </View>
                <View className="flex-1 min-w-[180px]">
                  <Text className="text-white/70 text-sm mb-2">Precio turno noche</Text>
                  <TextInput
                    value={form.precio_noche}
                    onChangeText={(text) => handleChange('precio_noche', text.replace(/[^0-9.,]/g, ''))}
                    keyboardType="decimal-pad"
                    placeholder="2700"
                    placeholderTextColor="#94A3B8"
                    className={FIELD_STYLES}
                  />
                </View>
              </View>

              <View>
                <Text className="text-white/70 text-sm mb-2">Tipo de suelo</Text>
                <TextInput
                  value={form.tipo_suelo}
                  onChangeText={(text) => handleChange('tipo_suelo', text)}
                  placeholder="Cemento, césped, parquet..."
                  placeholderTextColor="#94A3B8"
                  className={FIELD_STYLES}
                />
              </View>

              <View className="flex-row flex-wrap gap-4">
                <View className="flex-1 min-w-[160px]">
                  <Text className="text-white/70 text-sm mb-2">Techada</Text>
                  <View className="flex-row items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <Text className="text-white/80">{form.techada ? 'Sí' : 'No'}</Text>
                    <Switch value={!!form.techada} onValueChange={() => toggleBoolean('techada')} />
                  </View>
                </View>
                <View className="flex-1 min-w-[160px]">
                  <Text className="text-white/70 text-sm mb-2">Iluminación</Text>
                  <View className="flex-row items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <Text className="text-white/80">{form.iluminacion ? 'Sí' : 'No'}</Text>
                    <Switch value={!!form.iluminacion} onValueChange={() => toggleBoolean('iluminacion')} />
                  </View>
                </View>
              </View>

              <View>
                <Text className="text-white/70 text-sm mb-2">Estado</Text>
                <View className="flex-row flex-wrap gap-2">
                  {ESTADOS.map((state) => {
                    const active = form.estado === state.value;
                    return (
                      <Pressable
                        key={state.value}
                        onPress={() => handleChange('estado', state.value)}
                        className={`rounded-2xl px-4 py-2 border text-sm font-medium ${
                          active ? 'border-mc-warn bg-mc-warn/20 text-mc-warn' : 'border-white/10 bg-white/5 text-white/80'
                        }`}
                      >
                        <Text className={active ? 'text-mc-warn' : 'text-white/80'}>{state.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View>
                <Text className="text-white/70 text-sm mb-2">Imagen destacada</Text>
                <View className="flex-row items-center gap-4">
                  <View className="h-24 w-32 rounded-2xl border border-white/10 bg-white/5 overflow-hidden items-center justify-center">
                    {previewUri ? (
                      <Image source={{ uri: previewUri }} className="h-full w-full" resizeMode="cover" />
                    ) : (
                      <Ionicons name="image-outline" size={24} color="#94A3B8" />
                    )}
                  </View>
                  <View className="flex-1 gap-2">
                    <Pressable
                      onPress={handlePickImage}
                      disabled={pickingImage}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 self-start hover:bg-white/10"
                    >
                      <Text className="text-white/80 text-sm font-medium">
                        {pickingImage ? 'Abriendo biblioteca...' : 'Seleccionar imagen'}
                      </Text>
                    </Pressable>
                    {imageError ? <Text className="text-mc-warn text-xs">{imageError}</Text> : null}
                    <Text className="text-white/40 text-xs">
                      Formatos admitidos: JPG, PNG, WEBP. Tamaño recomendado 1200x800px.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>

          <View className="flex-row items-center justify-end gap-3 border-t border-white/5 pt-4">
            <Pressable
              onPress={() => {
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
                {loading ? 'Guardando...' : 'Guardar cambios'}
              </Text>
            </Pressable>
          </View>
        </Card>
        {renderSportPicker()}
      </View>
    </Modal>
  );
}
