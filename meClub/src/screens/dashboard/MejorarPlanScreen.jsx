import React from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import Card from '../../components/Card';
import ScreenHeader from '../../components/ScreenHeader';
import { useAuth } from '../../features/auth/useAuth';

export default function MejorarPlanScreen({ go }) {
  const { user, updateUser } = useAuth();
  const activeNivelId = Number(user?.nivel_id ?? 1);

  const plans = [
    {
      id: 1,
      name: 'Gratuito',
      description: 'Ideal para comenzar y centralizar la gestión básica.',
      price: '$0',
      benefits: ['Perfil del club', 'Reservas básicas', 'Soporte por email'],
    },
    {
      id: 2,
      name: 'Avanzado',
      description: 'Más visibilidad y control sobre tus membresías.',
      price: '$14.990',
      benefits: ['Gestión de socios', 'Reportes mensuales', 'Promociones'],
    },
    {
      id: 3,
      name: 'Pro',
      description: 'La experiencia completa para clubes en crecimiento.',
      price: '$29.990',
      benefits: ['Automatizaciones', 'Integraciones premium', 'Soporte prioritario'],
    },
  ];

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="flex-row items-center justify-between px-4 md:px-0">
        <ScreenHeader
          title="Mejorar plan"
          subtitle="Muy pronto vas a poder ampliar el nivel de tu club"
        />
        <Pressable
          onPress={() => go?.('configuracion')}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10"
        >
          <Text className="text-white/80 text-sm font-medium">Volver</Text>
        </Pressable>
      </View>

      <View className="mt-8 mx-4 md:mx-0 space-y-4">
        <Card className="p-4">
          <Text className="text-white/90 text-base font-semibold">
            Próximamente integración de pagos
          </Text>
          <Text className="text-white/70 text-sm mt-2">
            Podés seleccionar un plan para conocer la experiencia completa. La integración de pagos
            estará disponible muy pronto.
          </Text>
        </Card>

        <View className="gap-4 md:flex-row">
          {plans.map((plan) => {
            const isActive = plan.id === activeNivelId;
            return (
              <Card
                key={plan.id}
                className={`flex-1 p-5 border ${
                  isActive ? 'border-emerald-400/70' : 'border-white/10'
                }`}
              >
                <View className="flex-row items-start justify-between">
                  <View className="space-y-1">
                    <Text className="text-white text-lg font-semibold">{plan.name}</Text>
                    <Text className="text-white/60 text-sm">{plan.description}</Text>
                  </View>
                  {isActive ? (
                    <View className="rounded-full border border-emerald-400/70 bg-emerald-500/10 px-3 py-1">
                      <Text className="text-emerald-200 text-xs font-semibold">
                        Plan activo
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View className="mt-4">
                  <Text className="text-white text-3xl font-semibold">{plan.price}</Text>
                  <Text className="text-white/50 text-xs mt-1">por mes</Text>
                </View>

                <View className="mt-4 space-y-2">
                  {plan.benefits.map((benefit) => (
                    <Text key={benefit} className="text-white/70 text-sm">
                      • {benefit}
                    </Text>
                  ))}
                </View>

                <Pressable
                  onPress={() => updateUser({ nivel_id: plan.id })}
                  className={`mt-6 rounded-2xl px-4 py-2 ${
                    isActive
                      ? 'border border-emerald-400/50 bg-emerald-500/10'
                      : 'bg-white/10 hover:bg-white/15'
                  }`}
                >
                  <Text className="text-white text-sm font-semibold text-center">
                    {isActive ? 'Plan seleccionado' : 'Seleccionar plan'}
                  </Text>
                </Pressable>
              </Card>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
