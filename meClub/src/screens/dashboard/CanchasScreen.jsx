import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/Card';
import {
  createClubCourt,
  deleteClubCourt,
  getClubCourtSummary,
  getClubCourts,
  listSports,
  resolveAssetUrl,
  updateClubCourt,
  uploadClubCourtImage,
} from '../../lib/api';
import CourtFormModal from './CourtFormModal';
import CourtSummaryModal from './CourtSummaryModal';

const STATUS_COLORS = {
  disponible: 'text-emerald-400',
  mantenimiento: 'text-amber-400',
  inactiva: 'text-red-400',
};

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') {
    return 'Sin definir';
  }
  const num = Number(value);
  if (!Number.isFinite(num)) return 'Sin definir';
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `$${Math.round(num)}`;
  }
}

function formatBoolean(value) {
  if (value === null || value === undefined) return 'Sin definir';
  return value ? 'Sí' : 'No';
}

function statusLabel(value) {
  switch (value) {
    case 'mantenimiento':
      return 'En mantenimiento';
    case 'inactiva':
      return 'Inactiva';
    case 'disponible':
    default:
      return 'Disponible';
  }
}

function confirmDeletion(courtName, onConfirm) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    const accepted = typeof window !== 'undefined' ? window.confirm(`¿Eliminar ${courtName}?`) : true;
    if (accepted) onConfirm();
    return;
  }
  Alert.alert(
    'Eliminar cancha',
    courtName ? `¿Seguro que querés eliminar ${courtName}?` : '¿Seguro que querés eliminar esta cancha?',
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: onConfirm },
    ]
  );
}

export default function CanchasScreen({ go }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [courts, setCourts] = useState([]);
  const [sports, setSports] = useState([]);
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [activeCourt, setActiveCourt] = useState(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [summaryData, setSummaryData] = useState(null);

  const loadCourts = useCallback(async ({ showSpinner = false } = {}) => {
    if (showSpinner) {
      setLoading(true);
    }
    try {
      const data = await getClubCourts();
      setCourts(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setCourts([]);
      setError(err?.message || 'No pudimos cargar tus canchas');
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await listSports();
        if (alive && Array.isArray(list)) {
          setSports(list);
        }
      } catch (err) {
        console.warn('listSports', err);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    loadCourts({ showSpinner: true });
  }, [loadCourts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCourts();
  }, [loadCourts]);

  const handleOpenCreate = useCallback(() => {
    setFormMode('create');
    setActiveCourt(null);
    setFormError('');
    setFormVisible(true);
  }, []);

  const handleOpenEdit = useCallback((court) => {
    setFormMode('edit');
    setActiveCourt(court);
    setFormError('');
    setFormVisible(true);
  }, []);

  const handleSubmitForm = async ({ values, image }) => {
    if (!values) return;
    setFormLoading(true);
    setFormError('');
    try {
      if (formMode === 'edit' && activeCourt) {
        await updateClubCourt(activeCourt.cancha_id, values);
        if (image) {
          await uploadClubCourtImage(activeCourt.cancha_id, image);
        }
      } else {
        const created = await createClubCourt(values);
        const createdId = created?.cancha_id;
        if (image && createdId) {
          await uploadClubCourtImage(createdId, image);
        }
      }
      await loadCourts();
      setFormVisible(false);
    } catch (err) {
      setFormError(err?.message || 'No pudimos guardar los cambios');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteCourt = useCallback(
    async (court) => {
      const performDelete = async () => {
        try {
          await deleteClubCourt(court.cancha_id);
          await loadCourts();
        } catch (err) {
          setError(err?.message || 'No pudimos eliminar la cancha');
        }
      };
      confirmDeletion(court?.nombre, performDelete);
    },
    [loadCourts]
  );

  const handleOpenSummary = useCallback(async (court) => {
    setSummaryVisible(true);
    setSummaryLoading(true);
    setSummaryError('');
    setSummaryData(null);
    setActiveCourt(court);
    try {
      const data = await getClubCourtSummary(court.cancha_id);
      setSummaryData(data || {});
    } catch (err) {
      setSummaryError(err?.message || 'No pudimos cargar el resumen');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const cards = useMemo(() => {
    return courts.map((court) => {
      const infoItems = [
        {
          icon: 'people-outline',
          label: 'Capacidad',
          value:
            court.capacidad === null || court.capacidad === undefined
              ? 'Sin definir'
              : `${court.capacidad} jugadores`,
        },
        {
          icon: 'cash-outline',
          label: 'Precio base',
          value: formatCurrency(court.precio),
        },
        {
          icon: 'sunny-outline',
          label: 'Turno día',
          value: formatCurrency(court.precio_dia),
        },
        {
          icon: 'moon-outline',
          label: 'Turno noche',
          value: formatCurrency(court.precio_noche),
        },
        {
          icon: 'layers-outline',
          label: 'Tipo de suelo',
          value: court.tipo_suelo || 'Sin definir',
        },
        {
          icon: 'home-outline',
          label: 'Techada',
          value: formatBoolean(court.techada),
        },
        {
          icon: 'bulb-outline',
          label: 'Iluminación',
          value: formatBoolean(court.iluminacion),
        },
        {
          icon: 'checkmark-circle-outline',
          label: 'Estado',
          value: statusLabel(court.estado),
          status: court.estado,
        },
      ];

      const preview = court.imagen_url ? resolveAssetUrl(court.imagen_url) : null;

      return (
        <Card key={court.cancha_id} className="mb-6">
          <View className="flex-col gap-4 md:flex-row md:gap-6">
            <View className="w-full md:w-48">
              <View className="h-40 w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 items-center justify-center">
                {preview ? (
                  <Image source={{ uri: preview }} className="h-full w-full" resizeMode="cover" />
                ) : (
                  <Ionicons name="image-outline" size={32} color="#94A3B8" />
                )}
              </View>
            </View>

            <View className="flex-1">
              <View className="flex-row flex-wrap items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-white text-2xl font-semibold tracking-tight">
                    {court.nombre}
                  </Text>
                  <Text className="text-white/60 text-sm mt-1">
                    {court.deporte_nombre || 'Deporte no especificado'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleDeleteCourt(court)}
                  className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-2 hover:bg-red-400/20"
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="trash-outline" size={16} color="#FCA5A5" />
                    <Text className="text-[#FCA5A5] text-sm font-medium">Eliminar</Text>
                  </View>
                </Pressable>
              </View>

              <View className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {infoItems.map((item) => (
                  <View
                    key={`${court.cancha_id}-${item.label}`}
                    className="flex-row items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <Ionicons name={item.icon} size={18} color="#FBBF24" />
                    <View className="flex-1">
                      <Text className="text-white/50 text-xs uppercase tracking-widest">
                        {item.label}
                      </Text>
                      <Text
                        className={`text-white text-sm font-medium ${
                          item.status ? STATUS_COLORS[item.status] || 'text-white' : ''
                        }`}
                      >
                        {item.value}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View className="mt-6 flex-row flex-wrap gap-3">
                <Pressable
                  onPress={() => handleOpenSummary(court)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10"
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="bar-chart-outline" size={16} color="#FBBF24" />
                    <Text className="text-white/80 text-sm font-medium">Ver estado</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => handleOpenEdit(court)}
                  className="rounded-2xl bg-mc-warn px-4 py-2 hover:bg-mc-warn/80"
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="create-outline" size={16} color="#0A0F1D" />
                    <Text className="text-[#0A0F1D] text-sm font-semibold">Editar</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </View>
        </Card>
      );
    });
  }, [courts, handleDeleteCourt, handleOpenEdit, handleOpenSummary]);

  const renderContent = () => {
    if (loading) {
      return (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator color="#F59E0B" size="large" />
          <Text className="text-white/70 mt-4">Cargando tus canchas...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View className="flex-1 items-center justify-center py-20 px-6">
          <Ionicons name="warning-outline" size={32} color="#F97316" />
          <Text className="text-white/80 text-center text-base mt-3">{error}</Text>
          <Pressable
            onPress={() => loadCourts({ showSpinner: true })}
            className="mt-4 rounded-2xl bg-mc-warn px-4 py-2 hover:bg-mc-warn/80"
          >
            <Text className="text-[#0A0F1D] text-sm font-semibold">Reintentar</Text>
          </Pressable>
        </View>
      );
    }

    if (!courts.length) {
      return (
        <View className="items-center justify-center py-20 px-6">
          <View className="h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <Ionicons name="tennisball-outline" size={28} color="#FBBF24" />
          </View>
          <Text className="text-white text-xl font-semibold mt-6">Todavía no cargaste canchas</Text>
          <Text className="text-white/60 text-center mt-2 max-w-xl">
            Creá tu primera cancha para empezar a tomar reservas y mantener toda la información actualizada.
          </Text>
          <Pressable
            onPress={handleOpenCreate}
            className="mt-6 rounded-2xl bg-mc-warn px-6 py-3 hover:bg-mc-warn/80"
          >
            <Text className="text-[#0A0F1D] text-sm font-semibold">Agregar cancha</Text>
          </Pressable>
        </View>
      );
    }

    return <View className="mt-8 px-4 md:px-0">{cards}</View>;
  };

  return (
    <View className="flex-1">
      <ScrollView
        className="py-6"
        contentContainerClassName="pb-28"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />}
      >
        <View className="flex-row flex-wrap items-center justify-between gap-3 px-4 md:px-0">
          <View>
            <Text className="text-white text-[32px] font-extrabold tracking-tight">Mis Canchas</Text>
            <Text className="text-white/60 mt-1">Gestioná los espacios disponibles en tu club</Text>
          </View>
          <View className="flex-row flex-wrap items-center gap-3">
            <Pressable
              onPress={() => go?.('inicio')}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10"
            >
              <Text className="text-white/80 text-sm font-medium">Volver al inicio</Text>
            </Pressable>
            <Pressable
              onPress={handleOpenCreate}
              className="rounded-2xl bg-mc-warn px-4 py-2 hover:bg-mc-warn/80"
            >
              <View className="flex-row items-center gap-2">
                <Ionicons name="add" size={18} color="#0A0F1D" />
                <Text className="text-[#0A0F1D] text-sm font-semibold">Agregar cancha</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {renderContent()}
      </ScrollView>

      <CourtFormModal
        visible={formVisible}
        onDismiss={() => {
          if (!formLoading) {
            setFormVisible(false);
            setFormError('');
          }
        }}
        onSubmit={handleSubmitForm}
        initialValues={formMode === 'edit' ? activeCourt : null}
        loading={formLoading}
        title={formMode === 'edit' ? 'Editar cancha' : 'Agregar cancha'}
        sports={sports}
        errorMessage={formError}
      />

      <CourtSummaryModal
        visible={summaryVisible}
        onClose={() => setSummaryVisible(false)}
        court={activeCourt}
        summary={summaryData}
        loading={summaryLoading}
        error={summaryError}
      />
    </View>
  );
}
