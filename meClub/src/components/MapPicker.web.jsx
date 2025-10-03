/* global google */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View, Platform } from 'react-native';
import * as Location from 'expo-location';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';

const GOOGLE_MAP_LIBRARIES = ['marker'];

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
  children,
}) {
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [mapError, setMapError] = useState('');
  const [pendingLatitude, setPendingLatitude] = useState('');
  const [pendingLongitude, setPendingLongitude] = useState('');
  const [mapLoadError, setMapLoadError] = useState('');
  const [mapInstance, setMapInstance] = useState(null);

  const hasCoordinate = useMemo(
    () => typeof latitude === 'number' && typeof longitude === 'number',
    [latitude, longitude],
  );

  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const googleMapsMapId = process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID;

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-maps-script',
    googleMapsApiKey: googleMapsApiKey ?? '',
    libraries: GOOGLE_MAP_LIBRARIES,
  });

  const mapOptions = useMemo(
    () => ({
      streetViewControl: false,
      mapTypeControl: false,
      ...(googleMapsMapId ? { mapId: googleMapsMapId } : {}),
    }),
    [googleMapsMapId],
  );

  const shouldUseAdvancedMarker = useMemo(
    () =>
      Boolean(
        googleMapsMapId &&
          isLoaded &&
          typeof google !== 'undefined' &&
          google?.maps?.marker?.AdvancedMarkerElement,
      ),
    [googleMapsMapId, isLoaded],
  );

  useEffect(() => {
    if (loadError) {
      setMapLoadError('No pudimos cargar Google Maps. Ingresá las coordenadas manualmente.');
    } else if (isLoaded) {
      setMapLoadError('');
    }
  }, [isLoaded, loadError]);

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

  const mapCenter = useMemo(
    () => ({
      lat: hasCoordinate ? latitude : -34.6037,
      lng: hasCoordinate ? longitude : -58.3816,
    }),
    [hasCoordinate, latitude, longitude],
  );

  const handleMapEvent = useCallback(
    (event) => {
      const lat = event?.latLng?.lat();
      const lng = event?.latLng?.lng();
      if (typeof lat === 'number' && typeof lng === 'number') {
        emitChange({ latitude: lat, longitude: lng });
      }
    },
    [emitChange],
  );

  useEffect(() => {
    if (!mapInstance) return undefined;
    const clickListener = mapInstance.addListener('click', handleMapEvent);
    return () => {
      clickListener.remove();
    };
  }, [mapInstance, handleMapEvent]);

  useEffect(() => {
    if (hasCoordinate) {
      setPendingLatitude(latitude.toFixed(5));
      setPendingLongitude(longitude.toFixed(5));
    }
  }, [hasCoordinate, latitude, longitude]);

  const handleSelectCurrentLocation = useCallback(async () => {
    setIsRequestingLocation(true);
    setMapError('');
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.isSecureContext) {
        setMapError('Necesitás abrir la app con HTTPS para usar tu ubicación actual.');
        return;
      }
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
    <View style={style} className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
      <View className="flex w-full flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-black/20 lg:w-1/2">
        <View className="flex-1 min-h-[16rem]">
          {mapLoadError || !googleMapsApiKey ? (
            <View className="flex-1 items-center justify-center gap-3 px-6 text-center">
              <Text className="text-white/70 text-sm font-medium">Mapa interactivo no disponible en este momento</Text>
              <Text className="text-white/50 text-xs">
                {mapLoadError || 'Configurá la clave EXPO_PUBLIC_GOOGLE_MAPS_API_KEY para habilitar el mapa.'}
              </Text>
            </View>
          ) : !isLoaded ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#F59E0B" />
            </View>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={mapCenter}
              zoom={hasCoordinate ? 14 : 4}
              options={mapOptions}
              mapId={googleMapsMapId || undefined}
              onLoad={(map) => setMapInstance(map)}
              onUnmount={() => setMapInstance(null)}
            >
              {hasCoordinate &&
                (shouldUseAdvancedMarker ? (
                  mapInstance && (
                    <AdvancedMarker map={mapInstance} position={mapCenter} onDragEnd={handleMapEvent} />
                  )
                ) : (
                  <MarkerF position={mapCenter} draggable onDragEnd={handleMapEvent} />
                ))}
            </GoogleMap>
          )}
        </View>
      </View>
      <View className="flex w-full flex-col gap-4 lg:w-1/2">
        {children}
        <View className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-black/20 p-4">
          <View className="gap-2">
            <Text className="text-white/70 text-xs uppercase tracking-[0.2em]">Ubicación seleccionada</Text>
            <View className="flex flex-col gap-2">
              <View className="flex flex-col gap-1">
                <Text className="text-white/50 text-[11px]">Latitud</Text>
                <TextInput
                  value={pendingLatitude}
                  onChangeText={setPendingLatitude}
                  keyboardType="numeric"
                  placeholder="-34.6037"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-white"
                />
              </View>
              <View className="flex flex-col gap-1">
                <Text className="text-white/50 text-[11px]">Longitud</Text>
                <TextInput
                  value={pendingLongitude}
                  onChangeText={setPendingLongitude}
                  keyboardType="numeric"
                  placeholder="-58.3816"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-white"
                />
              </View>
            </View>
            {hasCoordinate ? (
              <Text className="text-white/40 text-[11px]">Google place: {googlePlaceId ?? 'Sin información adicional'}</Text>
            ) : (
              <Text className="text-white/60 text-sm">Elegí un punto con los controles disponibles</Text>
            )}
          </View>
          <View className="flex flex-col gap-2">
            <Pressable
              onPress={handleApplyManualCoordinates}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-center hover:bg-white/10"
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
    </View>
  );
}

function AdvancedMarker({ map, position, onDragEnd }) {
  const markerRef = useRef(null);

  useEffect(() => {
    if (!map || !position || !google?.maps?.marker?.AdvancedMarkerElement) return undefined;

    let marker = markerRef.current;
    if (!marker) {
      marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        gmpDraggable: true,
      });
      markerRef.current = marker;
    } else {
      marker.position = position;
      if (marker.map !== map) {
        marker.map = map;
      }
    }

    const dragListener = marker.addListener('dragend', (event) => {
      onDragEnd?.(event);
    });

    return () => {
      dragListener.remove();
    };
  }, [map, position, onDragEnd]);

  useEffect(
    () => () => {
      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
    },
    [],
  );

  return null;
}
