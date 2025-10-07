import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/Card';

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('es-AR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }).format(date);
  } catch {
    return dateStr;
  }
}

function formatTime(value) {
  if (!value) return '';
  return value.slice(0, 5);
}

export default function CourtSummaryModal({ visible, onClose, court, summary, loading, error }) {
  const estado = summary?.estado || court?.estado || 'disponible';
  const estadoLabel = {
    disponible: 'Disponible',
    mantenimiento: 'En mantenimiento',
    inactiva: 'Inactiva',
  }[estado] || estado;

  const disponibleAhora = summary?.disponibleAhora;
  const proximas = summary?.proximasReservas || [];
  const reservasHoy = summary?.reservasHoy || [];
  const proximaReserva = summary?.proximaReserva;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        onClose?.();
      }}
    >
      <View className="flex-1 bg-black/70 items-center justify-center px-4">
        <Card className="w-full max-w-3xl max-h-[85vh]">
          <View className="flex-row items-center justify-between mb-5">
            <View>
              <Text className="text-white text-2xl font-bold tracking-tight">Estado general</Text>
              <Text className="text-white/60 text-sm mt-1">
                {court?.nombre ? `Resumen de ${court.nombre}` : 'Detalle de la cancha'}
              </Text>
            </View>
            <Pressable
              onPress={() => onClose?.()}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/5"
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          {loading ? (
            <View className="py-16 items-center justify-center gap-3">
              <ActivityIndicator color="#F59E0B" size="large" />
              <Text className="text-white/70">Cargando estado...</Text>
            </View>
          ) : error ? (
            <View className="py-12 items-center">
              <Ionicons name="warning" size={28} color="#F97316" />
              <Text className="text-white/80 text-sm mt-2 text-center px-4">{error}</Text>
            </View>
          ) : (
            <ScrollView className="flex-1" contentContainerClassName="pb-4 gap-6">
              <View className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <View className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <Text className="text-white/60 text-xs uppercase tracking-widest">Estado</Text>
                  <Text className="text-white text-xl font-semibold mt-2">{estadoLabel}</Text>
                  <Text className="text-white/60 text-sm mt-1">
                    {disponibleAhora
                      ? 'Disponible para reservar en este momento'
                      : 'No disponible ahora mismo'}
                  </Text>
                </View>

                <View className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <Text className="text-white/60 text-xs uppercase tracking-widest">Reservas hoy</Text>
                  <Text className="text-white text-3xl font-bold mt-2">{reservasHoy.length}</Text>
                  <Text className="text-white/50 text-sm mt-1">Total de turnos registrados para hoy</Text>
                </View>

                <View className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <Text className="text-white/60 text-xs uppercase tracking-widest">Próxima reserva</Text>
                  {proximaReserva ? (
                    <View className="mt-2">
                      <Text className="text-white text-base font-medium">
                        {formatDate(proximaReserva.fecha)}
                      </Text>
                      <Text className="text-white/70 text-sm mt-1">
                        {formatTime(proximaReserva.hora_inicio)} - {formatTime(proximaReserva.hora_fin)}
                      </Text>
                      <Text className="text-white/40 text-xs mt-1">Estado: {proximaReserva.estado}</Text>
                    </View>
                  ) : (
                    <Text className="text-white/60 text-sm mt-2">No hay reservas próximas</Text>
                  )}
                </View>

                <View className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <Text className="text-white/60 text-xs uppercase tracking-widest">Próximos turnos</Text>
                  <Text className="text-white text-3xl font-bold mt-2">{proximas.length}</Text>
                  <Text className="text-white/50 text-sm mt-1">
                    Turnos agendados para los próximos días
                  </Text>
                </View>
              </View>

              <View>
                <Text className="text-white/80 text-base font-semibold mb-3">Detalle de reservas</Text>
                {reservasHoy.length === 0 && proximas.length === 0 ? (
                  <View className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 items-center">
                    <Ionicons name="calendar-outline" size={22} color="#94A3B8" />
                    <Text className="text-white/60 text-sm mt-2 text-center">
                      Esta cancha no tiene reservas registradas recientemente.
                    </Text>
                  </View>
                ) : (
                  <View className="rounded-2xl border border-white/10 bg-white/5">
                    <View className="border-b border-white/5 px-4 py-3">
                      <Text className="text-white/50 text-xs uppercase tracking-widest">Hoy</Text>
                      {reservasHoy.length === 0 ? (
                        <Text className="text-white/60 text-sm mt-1">Sin reservas para hoy</Text>
                      ) : (
                        reservasHoy.map((item, idx) => (
                          <View
                            key={`${item.reserva_id || idx}-today`}
                            className="flex-row items-center justify-between py-2"
                          >
                            <Text className="text-white/70 text-sm">
                              {formatTime(item.hora_inicio)} - {formatTime(item.hora_fin)}
                            </Text>
                            <Text className="text-white/40 text-xs uppercase tracking-wide">
                              {item.estado}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                    <View className="px-4 py-3">
                      <Text className="text-white/50 text-xs uppercase tracking-widest">Próximas</Text>
                      {proximas.length === 0 ? (
                        <Text className="text-white/60 text-sm mt-1">Sin reservas próximas</Text>
                      ) : (
                        proximas.map((item, idx) => (
                          <View
                            key={`${item.reserva_id || idx}-next`}
                            className="py-2 border-b border-white/5 last:border-b-0"
                          >
                            <Text className="text-white text-sm font-medium">
                              {formatDate(item.fecha)}
                            </Text>
                            <Text className="text-white/70 text-sm mt-1">
                              {formatTime(item.hora_inicio)} - {formatTime(item.hora_fin)}
                            </Text>
                            <Text className="text-white/40 text-xs uppercase tracking-wide mt-1">
                              {item.estado}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </Card>
      </View>
    </Modal>
  );
}
