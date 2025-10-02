import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';

const buildPlaceId = (coordinate, address) => {
  if (!coordinate) return null;
  if (address?.name && address?.isoCountryCode) {
    return `${address.isoCountryCode}-${address.name}-${coordinate.latitude.toFixed(4)}-${coordinate.longitude.toFixed(4)}`;
  }
  return `${coordinate.latitude.toFixed(4)},${coordinate.longitude.toFixed(4)}`;
};

const clampCoordinate = (value, min, max) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.min(Math.max(value, min), max);
};

export default function MapPicker({
  latitude,
  longitude,
  googlePlaceId,
  onChange,
  style,
}) {
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [mapError, setMapError] = useState('');
  const [pendingLatitude, setPendingLatitude] = useState('');
  const [pendingLongitude, setPendingLongitude] = useState('');

  const hasCoordinate = useMemo(
    () => typeof latitude === 'number' && typeof longitude === 'number',
    [latitude, longitude],
  );

  useEffect(() => {
    if (hasCoordinate) {
      setPendingLatitude(latitude.toFixed(5));
      setPendingLongitude(longitude.toFixed(5));
    }
  }, [hasCoordinate, latitude, longitude]);

  const emitChange = useCallback(
    async (coordinate) => {
      if (!coordinate) return;
      setMapError('');
      let placeId = googlePlaceId ?? null;
      try {
        const [address] = await Location.reverseGeocodeAsync(coordinate).catch(() => []);
        placeId = buildPlaceId(coordinate, address);
      } catch (err) {
        setMapError('No pudimos obtener información adicional de la ubicación seleccionada');
      }
      onChange?.({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        google_place_id: placeId,
      });
    },
    [googlePlaceId, onChange],
  );

  const handleSelectCurrentLocation = useCallback(async () => {
    setIsRequestingLocation(true);
    setMapError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setMapError('Necesitamos permisos de ubicación para usar este atajo');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const coordinate = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setPendingLatitude(coordinate.latitude.toFixed(5));
      setPendingLongitude(coordinate.longitude.toFixed(5));
      await emitChange(coordinate);
    } catch (err) {
      setMapError('No pudimos obtener tu ubicación actual');
    } finally {
      setIsRequestingLocation(false);
    }
  }, [emitChange]);

  const handleApplyManualCoordinates = useCallback(async () => {
    const lat = clampCoordinate(parseFloat(pendingLatitude.replace(',', '.')), -90, 90);
    const lon = clampCoordinate(parseFloat(pendingLongitude.replace(',', '.')), -180, 180);

    if (lat === null || lon === null) {
      setMapError('Ingresá una latitud y longitud válidas');
      return;
    }

    await emitChange({ latitude: lat, longitude: lon });
  }, [emitChange, pendingLatitude, pendingLongitude]);

  return (
    <View style={style} className="gap-3">
      <View className="h-64 w-full items-center justify-center gap-3 rounded-3xl border border-dashed border-white/10 bg-white/5 px-6 text-center">
        <Text className="text-white/70 text-sm font-medium">Mapa interactivo no disponible en la versión web</Text>
        <Text className="text-white/50 text-xs">
          Ingresá coordenadas manualmente o usá tu ubicación actual para seleccionar un punto.
        </Text>
      </View>
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="gap-2">
          <Text className="text-white/70 text-xs uppercase tracking-[0.2em]">Ubicación seleccionada</Text>
          <View className="flex-row flex-wrap gap-2">
            <View className="flex-1 min-w-[120px]">
              <Text className="text-white/50 text-[11px]">Latitud</Text>
              <TextInput
                value={pendingLatitude}
                onChangeText={setPendingLatitude}
                keyboardType="numeric"
                placeholder="-34.6037"
                placeholderTextColor="rgba(255,255,255,0.3)"
                className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-white"
              />
            </View>
            <View className="flex-1 min-w-[120px]">
              <Text className="text-white/50 text-[11px]">Longitud</Text>
              <TextInput
                value={pendingLongitude}
                onChangeText={setPendingLongitude}
                keyboardType="numeric"
                placeholder="-58.3816"
                placeholderTextColor="rgba(255,255,255,0.3)"
                className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-white"
              />
            </View>
          </View>
          {hasCoordinate ? (
            <Text className="text-white/40 text-[11px]">Google place: {googlePlaceId ?? 'Sin información adicional'}</Text>
          ) : (
            <Text className="text-white/60 text-sm">Elegí un punto con los controles disponibles</Text>
          )}
        </View>
        <View className="gap-2">
          <Pressable
            onPress={handleApplyManualCoordinates}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10"
          >
            <Text className="text-white/80 text-sm font-medium">Aplicar coordenadas</Text>
          </Pressable>
          <Pressable
            onPress={handleSelectCurrentLocation}
            disabled={isRequestingLocation}
            className={`flex-row items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-2 ${
              isRequestingLocation ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            {isRequestingLocation && <ActivityIndicator color="#F59E0B" />}
            <Text className="text-white/80 text-sm font-medium">Usar mi ubicación actual</Text>
          </Pressable>
        </View>
      </View>
      {!!mapError && <Text className="text-red-300 text-xs">{mapError}</Text>}
    </View>
  );
}
