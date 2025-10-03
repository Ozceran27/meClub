import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

const DEFAULT_REGION = {
  latitude: -34.6037,
  longitude: -58.3816,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const buildRegion = (latitude, longitude) => ({
  latitude,
  longitude,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
});

const buildPlaceId = (coordinate, address) => {
  if (!coordinate) return null;
  if (address?.name && address?.isoCountryCode) {
    return `${address.isoCountryCode}-${address.name}-${coordinate.latitude.toFixed(4)}-${coordinate.longitude.toFixed(4)}`;
  }
  return `${coordinate.latitude.toFixed(4)},${coordinate.longitude.toFixed(4)}`;
};

export default function MapPicker({
  latitude,
  longitude,
  googlePlaceId,
  onChange,
  style,
  children,
}) {
  const mapRef = useRef(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [mapError, setMapError] = useState('');

  const hasCoordinate = typeof latitude === 'number' && typeof longitude === 'number';

  const region = useMemo(() => {
    if (hasCoordinate) {
      return buildRegion(latitude, longitude);
    }
    return DEFAULT_REGION;
  }, [hasCoordinate, latitude, longitude]);

  useEffect(() => {
    if (hasCoordinate && mapRef.current) {
      mapRef.current.animateToRegion(buildRegion(latitude, longitude), 300);
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
      if (mapRef.current) {
        mapRef.current.animateToRegion(buildRegion(coordinate.latitude, coordinate.longitude), 300);
      }
      await emitChange(coordinate);
    } catch (err) {
      setMapError('No pudimos obtener tu ubicación actual');
    } finally {
      setIsRequestingLocation(false);
    }
  }, [emitChange]);

  const handleMapPress = useCallback(
    async (event) => {
      const coordinate = event?.nativeEvent?.coordinate;
      if (!coordinate) return;
      await emitChange(coordinate);
    },
    [emitChange],
  );

  return (
    <View style={style} className="gap-3">
      <View className="h-64 w-full overflow-hidden rounded-3xl border border-white/10">
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={region}
          onPress={handleMapPress}
          pitchEnabled
          showsUserLocation={false}
          showsPointsOfInterest
        >
          {hasCoordinate && <Marker coordinate={{ latitude, longitude }} />}
        </MapView>
      </View>
      {children}
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View>
          <Text className="text-white/70 text-xs uppercase tracking-[0.2em]">Ubicación seleccionada</Text>
          {hasCoordinate ? (
            <Text className="text-white text-sm mt-1">
              {latitude.toFixed(5)}, {longitude.toFixed(5)}
            </Text>
          ) : (
            <Text className="text-white/60 text-sm mt-1">Elegí un punto en el mapa</Text>
          )}
          {googlePlaceId ? (
            <Text className="text-white/40 text-[11px] mt-1">Google place: {googlePlaceId}</Text>
          ) : null}
        </View>
        <Pressable
          onPress={handleSelectCurrentLocation}
          disabled={isRequestingLocation}
          className={`flex-row items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 ${
            isRequestingLocation ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10'
          }`}
        >
          {isRequestingLocation && <ActivityIndicator color="#F59E0B" />}
          <Text className="text-white/80 text-sm font-medium">Usar mi ubicación actual</Text>
        </Pressable>
      </View>
      {!!mapError && <Text className="text-red-300 text-xs">{mapError}</Text>}
    </View>
  );
}
