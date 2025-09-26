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
import { getClubProfile, updateClubProfile, listProvinces, uploadClubLogo, resolveAssetUrl } from '../../lib/api';
import { useAuth } from '../../features/auth/useAuth';

const FIELD_STYLES =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-mc-warn';

const buildFormState = (source = {}, fallback = {}) => ({
  nombre: source?.nombre ?? fallback?.nombre ?? '',
  descripcion: source?.descripcion ?? fallback?.descripcion ?? '',
  foto_logo: source?.foto_logo ?? fallback?.foto_logo ?? '',
  provincia_id: source?.provincia_id ?? fallback?.provincia_id ?? null,
});

export default function ConfiguracionScreen({ go }) {
  const { updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showProvinceMenu, setShowProvinceMenu] = useState(false);
  const [form, setForm] = useState(() => buildFormState());
  const [provinces, setProvinces] = useState([]);
  const [logoAsset, setLogoAsset] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [clubRes, provincesRes] = await Promise.all([getClubProfile(), listProvinces()]);
        if (!alive) return;
        if (Array.isArray(provincesRes)) {
          setProvinces(provincesRes);
        }
        setForm(buildFormState(clubRes));
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

  const provinceName = useMemo(() => {
    if (!form.provincia_id) return 'Seleccioná una provincia';
    const found = provinces?.find((p) => String(p.id) === String(form.provincia_id));
    return found ? found.nombre : 'Seleccioná una provincia';
  }, [form.provincia_id, provinces]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const logoPreviewUri = useMemo(() => {
    if (logoAsset?.uri) return logoAsset.uri;
    return form.foto_logo ? resolveAssetUrl(form.foto_logo) : '';
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

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      let nextLogoPath = form.foto_logo || null;
      if (logoAsset) {
        nextLogoPath = await uploadClubLogo(logoAsset);
        setLogoAsset(null);
      }

      const payload = {
        nombre: form.nombre,
        descripcion: form.descripcion,
        provincia_id: form.provincia_id ? Number(form.provincia_id) : null,
      };
      if (removeLogo) {
        payload.foto_logo = null;
      }
      const updated = await updateClubProfile(payload);
      const nextFormState = buildFormState(updated, {
        ...form,
        ...payload,
        foto_logo: removeLogo ? null : nextLogoPath ?? updated?.foto_logo ?? null,
      });
      setForm(nextFormState);
      await updateUser({
        clubNombre: nextFormState.nombre,
        foto_logo: nextFormState.foto_logo,
      });
      setSuccess('Datos guardados correctamente');
      setShowProvinceMenu(false);
      setRemoveLogo(false);
    } catch (err) {
      setError(err?.message || 'Hubo un problema al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <ActivityIndicator color="#F59E0B" size="large" />
        <Text className="text-white/70 mt-4">Cargando configuración...</Text>
      </View>
    );
  }

  return (
    <View className="py-6">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-white text-[32px] font-extrabold tracking-tight">Configuración</Text>
          <Text className="text-white/60 mt-1">Actualizá la información pública de tu club</Text>
        </View>
        <Pressable
          onPress={() => go?.('inicio')}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10"
        >
          <Text className="text-white/80 text-sm font-medium">Volver al inicio</Text>
        </Pressable>
      </View>

      <View className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
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
                {logoPreviewUri && (
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

          <View>
            <Text className="text-white/70 text-sm mb-2">Provincia</Text>
            <View className="relative z-50" style={{ elevation: 50 }}>
              <Pressable
                onPress={() => setShowProvinceMenu((prev) => !prev)}
                className="flex-row items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
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
                  className="absolute left-0 right-0 top-[110%] rounded-2xl border border-white/10 bg-[#111C3A] shadow-lg z-50"
                  style={{ elevation: 50 }}
                >
                  <ScrollView style={{ maxHeight: 200 }}>
                    {(provinces || []).map((prov) => (
                      <Pressable
                        key={prov.id}
                        onPress={() => {
                          handleChange('provincia_id', prov.id);
                          setShowProvinceMenu(false);
                        }}
                        className={`px-4 py-3 ${
                          String(prov.id) === String(form.provincia_id)
                            ? 'bg-white/10'
                            : 'bg-transparent'
                        } hover:bg-white/10`}
                      >
                        <Text className="text-white/90 text-base">{prov.nombre}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>
        </View>

        {(error || success) && (
          <View className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            {!!error && <Text className="text-red-300 text-sm">{error}</Text>}
            {!!success && <Text className="text-emerald-300 text-sm">{success}</Text>}
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
      </View>
    </View>
  );
}
