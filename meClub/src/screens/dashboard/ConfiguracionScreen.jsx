import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Card from '../../components/Card';
import ScreenHeader from '../../components/ScreenHeader';
import {
  getClubProfile,
  updateClubProfile,
  listProvinces,
  uploadClubLogo,
  resolveAssetUrl,
  listLocalities,
  getClubServices,
  updateClubServices,
  listAvailableServices,
  getClubTaxes,
  updateClubTaxes,
  getClubSchedule,
  updateClubSchedule,
} from '../../lib/api';
import { useAuth } from '../../features/auth/useAuth';
import MapPicker from '../../components/MapPicker';
import {
  DAYS,
  STATUS_LABELS,
  parseMaybeNumber,
  createClientId,
  normalizeCatalogServices,
  normalizeServices,
  normalizeTaxes,
  normalizeSchedule,
  denormalizeSchedule,
  sanitizeServicesForPayload,
  initialSaveStatus,
  buildFormState,
  composeAddress,
  splitAddress,
  normalizeTimeToHHMM,
} from './configurationState';

const FIELD_STYLES =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-mc-warn';

const MAX_SERVICES = 10;

export default function ConfiguracionScreen({ go }) {
  const { updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showProvinceMenu, setShowProvinceMenu] = useState(false);
  const [showLocalityMenu, setShowLocalityMenu] = useState(false);
  const [form, setForm] = useState(() => buildFormState());
  const [provinces, setProvinces] = useState([]);
  const [localities, setLocalities] = useState([]);
  const [localityQuery, setLocalityQuery] = useState('');
  const [localitiesLoading, setLocalitiesLoading] = useState(false);
  const [localityError, setLocalityError] = useState('');
  const [availableServices, setAvailableServices] = useState([]);
  const [logoAsset, setLogoAsset] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saveStatus, setSaveStatus] = useState(initialSaveStatus);
  const [serviceLimitWarning, setServiceLimitWarning] = useState('');
  const [timeErrors, setTimeErrors] = useState({
    hora_nocturna_inicio: '',
    hora_nocturna_fin: '',
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [
          clubRes,
          provincesRes,
          servicesRes,
          taxesRes,
          scheduleRes,
          catalogRes,
        ] = await Promise.all([
          getClubProfile(),
          listProvinces(),
          getClubServices(),
          getClubTaxes(),
          getClubSchedule(),
          listAvailableServices(),
        ]);
        if (!alive) return;
        if (Array.isArray(provincesRes)) {
          setProvinces(provincesRes);
        }
        setAvailableServices(normalizeCatalogServices(catalogRes));
        setForm(
          buildFormState(
            {
              ...clubRes,
              servicios: normalizeServices(servicesRes),
              impuestos: normalizeTaxes(taxesRes),
              horarios: scheduleRes,
            },
            clubRes,
          ),
        );
        setTimeErrors({ hora_nocturna_inicio: '', hora_nocturna_fin: '' });
        setLogoAsset(null);
        setRemoveLogo(false);
        setError('');
      } catch (err) {
        if (alive) setError(err?.message || 'No se pudieron cargar los datos');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!form.provincia_id) {
      setLocalities([]);
      setLocalityError('');
      setLocalitiesLoading(false);
      return () => {
        active = false;
      };
    }
    setLocalitiesLoading(true);
    setLocalityError('');
    (async () => {
      try {
        const list = await listLocalities(form.provincia_id, localityQuery);
        if (!active) return;
        setLocalities(list);
      } catch (err) {
        if (active) {
          setLocalities([]);
          setLocalityError(err?.message || 'No pudimos cargar las localidades');
        }
      } finally {
        if (active) setLocalitiesLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [form.provincia_id, localityQuery]);

  const provinceName = useMemo(() => {
    if (!form.provincia_id) return 'Seleccioná una provincia';
    const found = provinces?.find((p) => String(p.id) === String(form.provincia_id));
    return found ? found.nombre : 'Seleccioná una provincia';
  }, [form.provincia_id, provinces]);

  const localityName = useMemo(() => {
    if (form.localidad_nombre) return form.localidad_nombre;
    if (!form.localidad_id) return 'Seleccioná una localidad';
    const found = localities?.find((loc) => String(loc.id) === String(form.localidad_id));
    if (found?.nombre) return found.nombre;
    return 'Localidad seleccionada';
  }, [form.localidad_id, form.localidad_nombre, localities]);

  const handleChange = (key, value) => {
    setForm((prev) => {
      if (key === 'provincia_id') {
        return {
          ...prev,
          provincia_id: value,
          localidad_id: null,
          localidad_nombre: '',
        };
      }
      if (key === 'direccion_calle' || key === 'direccion_numero') {
        const nextStreet = key === 'direccion_calle' ? value : prev.direccion_calle;
        const nextNumber = key === 'direccion_numero' ? value : prev.direccion_numero;
        return {
          ...prev,
          direccion_calle: nextStreet,
          direccion_numero: nextNumber,
          direccion: composeAddress(nextStreet, nextNumber),
        };
      }
      if (key === 'hora_nocturna_inicio' || key === 'hora_nocturna_fin') {
        const digits = typeof value === 'string' ? value.replace(/\D/g, '').slice(0, 4) : '';
        let formatted = digits;
        if (digits.length > 2) {
          formatted = `${digits.slice(0, 2)}:${digits.slice(2)}`;
        }
        return { ...prev, [key]: formatted };
      }
      return { ...prev, [key]: value };
    });
    if (key === 'provincia_id') {
      setLocalityQuery('');
      setShowLocalityMenu(false);
    }
    if (key === 'hora_nocturna_inicio' || key === 'hora_nocturna_fin') {
      setTimeErrors((prev) => ({ ...prev, [key]: '' }));
    }
  };

  const handleSelectLocality = (locality) => {
    setForm((prev) => ({
      ...prev,
      localidad_id: locality?.id ?? null,
      localidad_nombre: locality?.nombre ?? '',
    }));
    setShowLocalityMenu(false);
  };

  const handleTimeBlur = (key) => {
    const value = form?.[key];
    if (!value) {
      setTimeErrors((prev) => ({ ...prev, [key]: '' }));
      if (value !== '') {
        setForm((prev) => ({ ...prev, [key]: '' }));
      }
      return;
    }

    const normalized = normalizeTimeToHHMM(value);
    if (!normalized) {
      setTimeErrors((prev) => ({ ...prev, [key]: 'Ingresá una hora válida (HH:MM)' }));
      return;
    }

    setTimeErrors((prev) => ({ ...prev, [key]: '' }));
    if (normalized !== value) {
      setForm((prev) => ({ ...prev, [key]: normalized }));
    }
  };

  const handleToggleService = (serviceId) => {
    setForm((prev) => {
      const id = String(serviceId);
      const current = new Set(prev.servicios || []);
      if (current.has(id)) {
        current.delete(id);
        setServiceLimitWarning('');
      } else {
        if (current.size >= MAX_SERVICES) {
          setServiceLimitWarning(`Máximo ${MAX_SERVICES} servicios por club.`);
          return prev;
        }
        current.add(id);
        setServiceLimitWarning('');
      }
      return { ...prev, servicios: Array.from(current) };
    });
  };

  const handleTaxChange = (id, field, value) => {
    setForm((prev) => ({
      ...prev,
      impuestos: (prev.impuestos || []).map((tax) =>
        String(tax.id) === String(id) ? { ...tax, [field]: value } : tax,
      ),
    }));
  };

  const handleAddTax = () => {
    const newTax = { id: createClientId(), nombre: '', porcentaje: '' };
    setForm((prev) => ({ ...prev, impuestos: [...(prev.impuestos || []), newTax] }));
  };

  const handleRemoveTax = (id) => {
    setForm((prev) => ({
      ...prev,
      impuestos: (prev.impuestos || []).filter((tax) => String(tax.id) !== String(id)),
    }));
  };

  const handleScheduleToggle = (dayKey) => {
    setForm((prev) => {
      const nextDay = prev.horarios?.[dayKey] ?? { enabled: false, ranges: [] };
      const toggled = !nextDay.enabled;
      const preservedRanges = Array.isArray(nextDay.ranges) ? nextDay.ranges : [];
      return {
        ...prev,
        horarios: {
          ...prev.horarios,
          [dayKey]: {
            enabled: toggled,
            ranges: toggled
              ? preservedRanges.length
                ? preservedRanges
                : [{ start: '08:00', end: '20:00' }]
              : preservedRanges,
          },
        },
      };
    });
  };

  const handleScheduleRangeChange = (dayKey, index, field, value) => {
    setForm((prev) => {
      const day = prev.horarios?.[dayKey] ?? { enabled: false, ranges: [] };
      const ranges = [...(day.ranges || [])];
      ranges[index] = { ...ranges[index], [field]: value };
      return {
        ...prev,
        horarios: {
          ...prev.horarios,
          [dayKey]: { ...day, ranges },
        },
      };
    });
  };

  const handleAddRange = (dayKey) => {
    setForm((prev) => {
      const day = prev.horarios?.[dayKey] ?? { enabled: false, ranges: [] };
      return {
        ...prev,
        horarios: {
          ...prev.horarios,
          [dayKey]: {
            ...day,
            enabled: true,
            ranges: [...(day.ranges || []), { start: '08:00', end: '20:00' }],
          },
        },
      };
    });
  };

  const handleRemoveRange = (dayKey, index) => {
    setForm((prev) => {
      const day = prev.horarios?.[dayKey] ?? { enabled: false, ranges: [] };
      const ranges = (day.ranges || []).filter((_, idx) => idx !== index);
      return {
        ...prev,
        horarios: {
          ...prev.horarios,
          [dayKey]: {
            ...day,
            ranges,
            enabled: ranges.length > 0 ? day.enabled : false,
          },
        },
      };
    });
  };

  const handleMapChange = (value) => {
    if (!value) return;
    setForm((prev) => ({
      ...prev,
      latitud: parseMaybeNumber(value.latitude),
      longitud: parseMaybeNumber(value.longitude),
      google_place_id: value.google_place_id ?? prev.google_place_id ?? '',
    }));
  };

  const updateStatus = (key, nextState) => {
    setSaveStatus((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...nextState },
    }));
  };

  const logoPreviewUri = useMemo(() => {
    if (logoAsset?.uri) return logoAsset.uri;
    return form.foto_logo ? resolveAssetUrl(form.foto_logo) : null;
  }, [logoAsset, form.foto_logo]);

  const handlePickLogo = async () => {
    try {
      setError('');
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          setError('Necesitamos permisos para acceder a tu galería');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (asset) {
        setLogoAsset(asset);
        setRemoveLogo(false);
      }
    } catch (err) {
      setError(err?.message || 'No pudimos abrir la galería');
    }
  };

  const handleClearLogo = () => {
    setLogoAsset(null);
    setRemoveLogo(true);
    setForm((prev) => ({ ...prev, foto_logo: '' }));
  };

  const runOperation = (key, fn) => {
    updateStatus(key, { state: 'pending', message: '' });
    return fn()
      .then((result) => {
        updateStatus(key, { state: 'success', message: '' });
        return { ok: true, result };
      })
      .catch((err) => {
        updateStatus(key, { state: 'error', message: err?.message || 'Error inesperado' });
        return { ok: false, error: err };
      });
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    setSaveStatus(initialSaveStatus);

    const nightStartNormalized = form.hora_nocturna_inicio
      ? normalizeTimeToHHMM(form.hora_nocturna_inicio)
      : '';
    const nightEndNormalized = form.hora_nocturna_fin
      ? normalizeTimeToHHMM(form.hora_nocturna_fin)
      : '';

    const nextTimeErrors = {
      hora_nocturna_inicio:
        form.hora_nocturna_inicio && !nightStartNormalized
          ? 'Ingresá una hora válida (HH:MM)'
          : '',
      hora_nocturna_fin:
        form.hora_nocturna_fin && !nightEndNormalized ? 'Ingresá una hora válida (HH:MM)' : '',
    };

    if (
      nightStartNormalized &&
      nightEndNormalized &&
      nightStartNormalized === nightEndNormalized
    ) {
      nextTimeErrors.hora_nocturna_fin = 'Las horas deben definir un rango válido';
    }

    const hasTimeErrors = Object.values(nextTimeErrors).some(Boolean);
    if (hasTimeErrors) {
      setTimeErrors(nextTimeErrors);
      setSaving(false);
      setError('Corregí las tarifas nocturnas antes de guardar.');
      return;
    }

    setTimeErrors({ hora_nocturna_inicio: '', hora_nocturna_fin: '' });

    const operations = [];

    operations.push(
      runOperation('profile', async () => {
        let nextLogoPath = form.foto_logo || null;
        if (logoAsset) {
          nextLogoPath = await uploadClubLogo(logoAsset);
        }

        const direccion = composeAddress(form.direccion_calle, form.direccion_numero);

        const payload = {
          nombre: form.nombre,
          descripcion: form.descripcion,
          provincia_id: form.provincia_id ? Number(form.provincia_id) : null,
          localidad_id: form.localidad_id ? Number(form.localidad_id) : null,
          telefono_contacto: form.telefono_contacto || null,
          email_contacto: form.email_contacto || null,
          direccion: direccion || null,
          latitud: form.latitud != null ? Number(form.latitud) : null,
          longitud: form.longitud != null ? Number(form.longitud) : null,
          google_place_id: form.google_place_id || null,
          hora_nocturna_inicio: nightStartNormalized || null,
          hora_nocturna_fin: nightEndNormalized || null,
        };
        if (removeLogo) {
          payload.foto_logo = null;
        }
        const updated = await updateClubProfile(payload);
        setForm((prev) => ({
          ...prev,
          nombre: updated?.nombre ?? payload.nombre ?? prev.nombre,
          descripcion: updated?.descripcion ?? payload.descripcion ?? prev.descripcion,
          provincia_id: updated?.provincia_id ?? payload.provincia_id ?? prev.provincia_id,
          localidad_id: updated?.localidad_id ?? payload.localidad_id ?? prev.localidad_id,
          localidad_nombre:
            updated?.localidad_nombre ?? updated?.localidad?.nombre ?? prev.localidad_nombre,
          telefono_contacto:
            updated?.telefono_contacto ?? payload.telefono_contacto ?? prev.telefono_contacto,
          email_contacto: updated?.email_contacto ?? payload.email_contacto ?? prev.email_contacto,
          direccion: updated?.direccion ?? payload.direccion ?? prev.direccion,
          ...(() => {
            const nextDireccionValue =
              updated?.direccion ?? payload.direccion ?? prev.direccion ?? '';
            const { street, number } = splitAddress(nextDireccionValue || '');
            return {
              direccion_calle: street,
              direccion_numero: number,
            };
          })(),
          latitud: parseMaybeNumber(updated?.latitud ?? payload.latitud ?? prev.latitud),
          longitud: parseMaybeNumber(updated?.longitud ?? payload.longitud ?? prev.longitud),
          google_place_id:
            updated?.google_place_id ?? payload.google_place_id ?? prev.google_place_id,
          hora_nocturna_inicio: normalizeTimeToHHMM(
            updated?.hora_nocturna_inicio ?? payload.hora_nocturna_inicio ?? prev.hora_nocturna_inicio
          ),
          hora_nocturna_fin: normalizeTimeToHHMM(
            updated?.hora_nocturna_fin ?? payload.hora_nocturna_fin ?? prev.hora_nocturna_fin
          ),
          foto_logo: removeLogo ? null : nextLogoPath ?? updated?.foto_logo ?? prev.foto_logo,
        }));
        setLogoAsset(null);
        setRemoveLogo(false);
        await updateUser({
          clubNombre: updated?.nombre ?? payload.nombre,
          foto_logo: removeLogo ? null : nextLogoPath ?? updated?.foto_logo ?? form.foto_logo,
        });
        return updated;
      }),
    );

    operations.push(
      runOperation('schedule', async () => {
        const items = denormalizeSchedule(form.horarios);
        const response = await updateClubSchedule(items);
        setForm((prev) => ({
          ...prev,
          horarios: normalizeSchedule(response),
        }));
        return response;
      }),
    );

    operations.push(
      runOperation('services', async () => {
        const response = await updateClubServices(sanitizeServicesForPayload(form.servicios));
        setForm((prev) => ({
          ...prev,
          servicios: normalizeServices(response),
        }));
        return response;
      }),
    );

    operations.push(
      runOperation('taxes', async () => {
        const response = await updateClubTaxes(form.impuestos);
        setForm((prev) => ({
          ...prev,
          impuestos: normalizeTaxes(response),
        }));
        return response;
      }),
    );

    const results = await Promise.all(operations);
    const hasErrors = results.some((res) => !res.ok);
    if (hasErrors) {
      setError('Algunos cambios no pudieron guardarse. Revisá el detalle a continuación.');
      setSuccess('');
    } else {
      setError('');
      setSuccess('Todos los cambios se guardaron correctamente');
    }
    setSaving(false);
  };

  const hasFeedback =
    Boolean(error) ||
    Boolean(success) ||
    Object.values(saveStatus).some((status) => status.state !== 'idle');

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <ActivityIndicator color="#F59E0B" size="large" />
        <Text className="text-white/70 mt-4">Cargando configuración...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="flex-row items-center justify-between px-4 md:px-0">
        <ScreenHeader
          title="Configuración"
          subtitle="Actualizá la información pública de tu club"
        />
        <Pressable
          onPress={() => go?.('inicio')}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10"
        >
          <Text className="text-white/80 text-sm font-medium">Volver al inicio</Text>
        </Pressable>
      </View>

      <Card className="mt-8 mx-4 md:mx-0 p-6">
        <View className="gap-6">
          <View>
            <Text className="text-white/70 text-sm mb-2">Nombre del club</Text>
            <TextInput
              value={form.nombre}
              onChangeText={(text) => handleChange('nombre', text)}
              placeholder="Club meClub"
              placeholderTextColor="#94A3B8"
              className={FIELD_STYLES}
            />
          </View>

          <View>
            <Text className="text-white/70 text-sm mb-2">Descripción</Text>
            <TextInput
              value={form.descripcion}
              onChangeText={(text) => handleChange('descripcion', text)}
              placeholder="Contale al mundo sobre tu club"
              placeholderTextColor="#94A3B8"
              className={`${FIELD_STYLES} min-h-[96px]`}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View>
            <Text className="text-white/70 text-sm mb-2">Logo</Text>
            <View className="flex-row items-center gap-4">
              <View className="h-20 w-20 rounded-2xl border border-white/10 bg-white/5 overflow-hidden items-center justify-center">
                {logoPreviewUri ? (
                  <Image source={{ uri: logoPreviewUri }} className="h-full w-full" resizeMode="cover" />
                ) : (
                  <Ionicons name="image-outline" size={28} color="#94A3B8" />
                )}
              </View>
              <View className="flex-1 gap-2">
                <Pressable
                  onPress={handlePickLogo}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10"
                  disabled={saving}
                >
                  <Text className="text-white/80 text-sm font-medium">
                    {logoPreviewUri ? 'Cambiar logo' : 'Seleccionar logo'}
                  </Text>
                </Pressable>
                {Boolean(logoPreviewUri) && (
                  <Pressable
                    onPress={handleClearLogo}
                    className="rounded-2xl border border-white/10 bg-transparent px-4 py-3 hover:bg-white/10"
                    disabled={saving}
                  >
                    <Text className="text-red-200 text-xs font-medium">Quitar logo</Text>
                  </Pressable>
                )}
              </View>
            </View>
            <Text className="text-white/40 text-xs mt-2">
              Formatos PNG, JPG o WEBP. Tamaño máximo 2MB.
            </Text>
          </View>

          <View className="grid gap-6 md:grid-cols-2">
            <View>
              <Text className="text-white/70 text-sm mb-2">Provincia</Text>
              <View className="relative z-50" style={{ zIndex: 60, elevation: 60 }}>
                <Pressable
                  onPress={() => setShowProvinceMenu((prev) => !prev)}
                  className="flex-row items-center justify-between rounded-2xl border border-white/10 bg-[#0B152E] px-4 py-3 transition-colors hover:bg-white/10"
                >
                  <Text className="text-white/90 text-base">{provinceName}</Text>
                  <Ionicons
                    name={showProvinceMenu ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#E2E8F0"
                  />
                </Pressable>
                {showProvinceMenu && (
                  <View
                    className="absolute left-0 right-0 top-[110%] rounded-2xl border border-white/10 bg-[#0B152E] shadow-xl z-50"
                    style={{ zIndex: 60, elevation: 60 }}
                  >
                    <ScrollView style={{ maxHeight: 240 }} className="bg-[#0B152E]">
                      {(provinces || []).map((prov) => {
                        const isSelected = String(prov.id) === String(form.provincia_id);
                        return (
                          <Pressable
                            key={prov.id}
                            onPress={() => {
                              handleChange('provincia_id', prov.id);
                              setShowProvinceMenu(false);
                            }}
                            className={`px-4 py-3 transition-colors ${
                              isSelected ? 'bg-white/10' : ''
                            } hover:bg-white/10`}
                          >
                            <Text className="text-white/90 text-base">{prov.nombre}</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            <View>
              <Text className="text-white/70 text-sm mb-2">Localidad</Text>
              <View className="relative z-50" style={{ zIndex: 60, elevation: 60 }}>
                <Pressable
                  onPress={() => {
                    if (!form.provincia_id) return;
                    setShowLocalityMenu((prev) => !prev);
                  }}
                  className={`flex-row items-center justify-between rounded-2xl border px-4 py-3 transition-colors ${
                    form.provincia_id
                      ? 'border-white/10 bg-[#0B152E] hover:bg-white/10'
                      : 'border-white/5 bg-[#121B33]'
                  }`}
                >
                  <Text className="text-white/90 text-base">
                    {form.provincia_id ? localityName : 'Seleccioná primero una provincia'}
                  </Text>
                  <Ionicons
                    name={showLocalityMenu ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#E2E8F0"
                  />
                </Pressable>
                {showLocalityMenu && (
                  <View
                    className="absolute left-0 right-0 top-[110%] rounded-2xl border border-white/10 bg-[#0B152E] shadow-xl z-50"
                    style={{ zIndex: 60, elevation: 60 }}
                  >
                    <View className="border-b border-white/10 bg-[#101C36] px-4 py-3">
                      <TextInput
                        value={localityQuery}
                        onChangeText={setLocalityQuery}
                        placeholder="Buscar localidad"
                        placeholderTextColor="#94A3B8"
                        className="rounded-xl border border-white/10 bg-[#16274A] px-3 py-2 text-white"
                      />
                    </View>
                    {localitiesLoading ? (
                      <View className="flex-row items-center justify-center gap-2 px-4 py-4">
                        <ActivityIndicator color="#F59E0B" />
                        <Text className="text-white/70 text-sm">Cargando...</Text>
                      </View>
                    ) : (
                      <ScrollView style={{ maxHeight: 240 }} className="bg-[#0B152E]">
                        {(localities || []).map((loc) => {
                          const isSelected = String(loc.id) === String(form.localidad_id);
                          return (
                            <Pressable
                              key={loc.id}
                              onPress={() => handleSelectLocality(loc)}
                              className={`px-4 py-3 transition-colors ${
                                isSelected ? 'bg-white/10' : ''
                              } hover:bg-white/10`}
                            >
                              <Text className="text-white/90 text-base">{loc.nombre}</Text>
                            </Pressable>
                          );
                        })}
                        {(!localities || localities.length === 0) && (
                          <View className="px-4 py-4">
                            <Text className="text-white/60 text-sm">
                              {localityError || 'No encontramos localidades para esta provincia'}
                            </Text>
                          </View>
                        )}
                      </ScrollView>
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>

          <View className="grid gap-6 md:grid-cols-2">
            <View>
              <Text className="text-white/70 text-sm mb-2">Teléfono de contacto</Text>
              <TextInput
                value={form.telefono_contacto}
                onChangeText={(text) => handleChange('telefono_contacto', text)}
                placeholder="Ej. +54 9 11 1234 5678"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                className={FIELD_STYLES}
              />
            </View>
            <View>
              <Text className="text-white/70 text-sm mb-2">Email de contacto</Text>
              <TextInput
                value={form.email_contacto}
                onChangeText={(text) => handleChange('email_contacto', text)}
                placeholder="contacto@club.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                className={FIELD_STYLES}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View>
            <Text className="text-white text-lg font-semibold">Tarifas nocturnas</Text>
            <Text className="text-white/60 text-sm mt-1">
              Indicá desde qué hora comienza la tarifa nocturna y hasta cuándo se aplica. Los valores usan el
              formato HH:MM en horario 24 h.
            </Text>
            <View className="mt-4 grid gap-6 md:grid-cols-2">
              <View>
                <Text className="text-white/70 text-sm mb-2">Inicio horario nocturno</Text>
                <TextInput
                  value={form.hora_nocturna_inicio}
                  onChangeText={(text) => handleChange('hora_nocturna_inicio', text)}
                  onBlur={() => handleTimeBlur('hora_nocturna_inicio')}
                  placeholder="Ej. 22:00"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  className={FIELD_STYLES}
                />
                {timeErrors.hora_nocturna_inicio ? (
                  <Text className="text-red-300 text-xs mt-2">{timeErrors.hora_nocturna_inicio}</Text>
                ) : null}
              </View>
              <View>
                <Text className="text-white/70 text-sm mb-2">Fin horario nocturno</Text>
                <TextInput
                  value={form.hora_nocturna_fin}
                  onChangeText={(text) => handleChange('hora_nocturna_fin', text)}
                  onBlur={() => handleTimeBlur('hora_nocturna_fin')}
                  placeholder="Ej. 06:00"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  className={FIELD_STYLES}
                />
                {timeErrors.hora_nocturna_fin ? (
                  <Text className="text-red-300 text-xs mt-2">{timeErrors.hora_nocturna_fin}</Text>
                ) : null}
              </View>
            </View>
          </View>

          <View>
            <Text className="text-white text-lg font-semibold">Ubicación y dirección</Text>
            <Text className="text-white/60 text-sm mt-1">
              Seleccioná el punto exacto de tu club o usá tu ubicación actual para completar latitud y longitud.
              También podés detallar la calle y el número para complementar la información.
            </Text>
            <MapPicker
              latitude={form.latitud ?? undefined}
              longitude={form.longitud ?? undefined}
              googlePlaceId={form.google_place_id}
              onChange={handleMapChange}
              style={{ marginTop: 16 }}
            >
              <View className="flex flex-col gap-3">
                <Text className="text-white/70 text-xs uppercase tracking-[0.2em]">Dirección</Text>
                <View className="flex flex-col gap-3">
                  <View className="flex flex-col gap-2">
                    <Text className="text-white/60 text-sm">Calle</Text>
                    <TextInput
                      value={form.direccion_calle}
                      onChangeText={(text) => handleChange('direccion_calle', text)}
                      placeholder="Ej. Av. Siempre Viva"
                      placeholderTextColor="#94A3B8"
                      className={FIELD_STYLES}
                    />
                  </View>
                  <View className="flex flex-col gap-2">
                    <Text className="text-white/60 text-sm">N°</Text>
                    <TextInput
                      value={form.direccion_numero}
                      onChangeText={(text) => handleChange('direccion_numero', text)}
                      placeholder="123"
                      placeholderTextColor="#94A3B8"
                      className={FIELD_STYLES}
                    />
                  </View>
                </View>
              </View>
            </MapPicker>
          </View>

          <View className="border-t border-white/10 pt-6">
            <Text className="text-white text-lg font-semibold">Horarios de atención</Text>
            <Text className="text-white/60 text-sm mt-1">
              Activá los días disponibles y definí los rangos horarios en los que tu club está abierto.
            </Text>
            <View className="mt-4 grid gap-4 lg:grid-cols-2">
              {DAYS.map((day) => {
                const dayConfig = form.horarios?.[day.key] ?? { enabled: false, ranges: [] };
                return (
                  <View
                    key={day.key}
                    className={`rounded-2xl border px-4 py-4 ${
                      dayConfig.enabled ? 'border-mc-warn/60 bg-mc-warn/10' : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white text-base font-semibold">{day.label}</Text>
                      <Pressable
                        onPress={() => handleScheduleToggle(day.key)}
                        className={`rounded-full border px-3 py-1 text-sm ${
                          dayConfig.enabled
                            ? 'border-mc-warn bg-mc-warn text-slate-900'
                            : 'border-white/20 bg-transparent'
                        }`}
                      >
                        <Text
                          className={
                            dayConfig.enabled
                              ? 'text-slate-900 text-xs font-semibold'
                              : 'text-white/70 text-xs font-semibold'
                          }
                        >
                          {dayConfig.enabled ? 'Activo' : 'Inactivo'}
                        </Text>
                      </Pressable>
                    </View>
                    {dayConfig.enabled && (
                      <View className="mt-3 gap-3">
                        {(dayConfig.ranges || []).map((range, index) => (
                          <View key={`${day.key}-${index}`} className="flex-row items-center gap-3">
                            <View className="flex-1">
                              <Text className="text-white/60 text-xs mb-1">Desde</Text>
                              <TextInput
                                value={range?.start ?? ''}
                                onChangeText={(text) =>
                                  handleScheduleRangeChange(day.key, index, 'start', text)
                                }
                                placeholder="08:00"
                                placeholderTextColor="#94A3B8"
                                className={FIELD_STYLES}
                              />
                            </View>
                            <View className="flex-1">
                              <Text className="text-white/60 text-xs mb-1">Hasta</Text>
                              <TextInput
                                value={range?.end ?? ''}
                                onChangeText={(text) =>
                                  handleScheduleRangeChange(day.key, index, 'end', text)
                                }
                                placeholder="20:00"
                                placeholderTextColor="#94A3B8"
                                className={FIELD_STYLES}
                              />
                            </View>
                            <Pressable
                              onPress={() => handleRemoveRange(day.key, index)}
                              className="h-11 w-11 items-center justify-center rounded-2xl border border-red-400/40"
                              accessibilityLabel={`Eliminar rango ${index + 1} de ${day.label}`}
                            >
                              <Ionicons name="trash-outline" size={18} color="#F87171" />
                            </Pressable>
                          </View>
                        ))}
                        <Pressable
                          onPress={() => handleAddRange(day.key)}
                          className="flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 px-4 py-3 hover:border-white/40"
                        >
                          <Ionicons name="add" size={18} color="#F59E0B" />
                          <Text className="text-white/80 text-sm font-medium">Agregar rango</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          <View className="border-t border-white/10 pt-6">
            <Text className="text-white text-lg font-semibold">Impuestos y recargos</Text>
            <Text className="text-white/60 text-sm mt-1">
              Configurá los impuestos que se aplican a tus reservas (por ejemplo, IVA o percepciones).
            </Text>
            <View className="mt-4 gap-4">
              {(form.impuestos || []).map((tax) => (
                <View
                  key={tax.id}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 md:px-6"
                >
                  <View className="flex-row items-start gap-4">
                    <View className="flex-1 gap-3">
                      <View>
                        <Text className="text-white/70 text-xs uppercase tracking-[0.2em]">Nombre</Text>
                        <TextInput
                          value={tax.nombre}
                          onChangeText={(text) => handleTaxChange(tax.id, 'nombre', text)}
                          placeholder="Ej. IVA"
                          placeholderTextColor="#94A3B8"
                          className={FIELD_STYLES}
                        />
                      </View>
                      <View>
                        <Text className="text-white/70 text-xs uppercase tracking-[0.2em]">Porcentaje</Text>
                        <TextInput
                          value={tax.porcentaje}
                          onChangeText={(text) => handleTaxChange(tax.id, 'porcentaje', text)}
                          placeholder="21"
                          placeholderTextColor="#94A3B8"
                          keyboardType="decimal-pad"
                          className={FIELD_STYLES}
                        />
                      </View>
                    </View>
                    <Pressable
                      onPress={() => handleRemoveTax(tax.id)}
                      className="h-10 w-10 items-center justify-center rounded-2xl border border-red-400/40"
                      accessibilityLabel={`Eliminar impuesto ${tax.nombre}`}
                    >
                      <Ionicons name="close" size={18} color="#F87171" />
                    </Pressable>
                  </View>
                </View>
              ))}
              <Pressable
                onPress={handleAddTax}
                className="flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 px-4 py-3 hover:border-white/40"
              >
                <Ionicons name="add-circle-outline" size={20} color="#F59E0B" />
                <Text className="text-white/80 text-sm font-medium">Agregar impuesto</Text>
              </Pressable>
            </View>
          </View>

          <View className="border-t border-white/10 pt-6">
            <Text className="text-white text-lg font-semibold">Servicios adicionales</Text>
            <Text className="text-white/60 text-sm mt-1">
              Seleccioná los servicios que tu club ofrece para que los socios puedan encontrarlos fácilmente.
            </Text>
            {!!serviceLimitWarning && (
              <View className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3">
                <Text className="text-amber-100 text-sm">{serviceLimitWarning}</Text>
              </View>
            )}
            <View className="mt-4 grid gap-3 md:grid-cols-2">
              {(availableServices || []).map((service) => {
                const selected = (form.servicios || []).some(
                  (item) => String(item) === String(service.id),
                );
                return (
                  <Pressable
                    key={service.id}
                    onPress={() => handleToggleService(service.id)}
                    className={`rounded-2xl border px-4 py-4 text-left ${
                      selected ? 'border-mc-warn/70 bg-mc-warn/10' : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <View
                        className={`h-5 w-5 items-center justify-center rounded ${
                          selected ? 'bg-mc-warn' : 'border border-white/30'
                        }`}
                      >
                        {selected && <Ionicons name="checkmark" size={14} color="#1F2937" />}
                      </View>
                      <View className="flex-1">
                        <Text className="text-white text-base font-semibold">{service.nombre}</Text>
                        {!!service.descripcion && (
                          <Text className="text-white/60 text-xs mt-1">{service.descripcion}</Text>
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
              {(!availableServices || availableServices.length === 0) && (
                <View className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6">
                  <Text className="text-white/60 text-sm">
                    Todavía no hay servicios cargados en tu club. Creá uno nuevo para poder seleccionarlo.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {hasFeedback && (
          <View className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 md:px-6">
            {!!error && <Text className="text-red-300 text-sm">{error}</Text>}
            {!!success && <Text className="text-emerald-300 text-sm">{success}</Text>}
            <View className="mt-2 gap-2">
              {Object.entries(saveStatus).map(([key, status]) => {
                if (status.state === 'idle') return null;
                const label = STATUS_LABELS[key] ?? key;
                if (status.state === 'pending') {
                  return (
                    <View key={key} className="flex-row items-center gap-2">
                      <ActivityIndicator color="#F59E0B" size="small" />
                      <Text className="text-white/80 text-sm">Guardando {label}...</Text>
                    </View>
                  );
                }
                if (status.state === 'success') {
                  return (
                    <View key={key} className="flex-row items-center gap-2">
                      <Ionicons name="checkmark-circle" size={16} color="#34D399" />
                      <Text className="text-emerald-200 text-sm">{label} guardado correctamente</Text>
                    </View>
                  );
                }
                return (
                  <View key={key} className="flex-row items-center gap-2">
                    <Ionicons name="alert-circle" size={16} color="#F87171" />
                    <Text className="text-red-200 text-sm">
                      {label}: {status.message || 'Hubo un problema'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View className="mt-6 flex-row justify-end">
          <Pressable
            onPress={handleSubmit}
            disabled={saving}
            className={`rounded-2xl px-6 py-3 ${
              saving ? 'bg-mc-warn/50' : 'bg-mc-warn hover:bg-mc-warn/90'
            }`}
          >
            {saving ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator color="#1F2937" />
                <Text className="text-slate-900 font-semibold">Guardando...</Text>
              </View>
            ) : (
              <Text className="text-slate-900 font-semibold">Guardar</Text>
            )}
          </Pressable>
        </View>
      </Card>
    </ScrollView>
  );
}
