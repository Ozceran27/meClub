import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useQuery, queryOptions } from '@tanstack/react-query';
import { getClubEconomy } from '../../lib/api';
import { useAuth } from '../../features/auth/useAuth';

const statusLabelMap = {
  pagado: 'Pagado',
  senado: 'Señado',
  pendiente_pago: 'Pendiente',
};

const statusColorMap = {
  pagado: 'text-emerald-300',
  senado: 'text-amber-200',
  pendiente_pago: 'text-slate-100',
};

const formatCurrency = (value) => `$${Number(value ?? 0).toLocaleString('es-AR')}`;

const getEconomyQueryOptions = ({ clubId, enabled }) =>
  queryOptions({
    queryKey: ['economia', clubId],
    enabled: !!clubId && enabled,
    queryFn: async () => getClubEconomy({ clubId }),
    select: (economy) => {
      const buildBreakdown = (source = {}) =>
        ['pagado', 'senado', 'pendiente_pago'].map((estado) => ({
          estado,
          label: statusLabelMap[estado] || estado,
          monto: source?.[estado] ?? 0,
        }));

      const sumValues = (source = {}) =>
        Object.values(source).reduce((acc, val) => acc + (Number(val) || 0), 0);

      const ingresosMes = economy?.ingresos?.mes ?? {};
      const ingresosSemana = economy?.ingresos?.semana ?? {};

      return {
        ingresosMes: {
          total: sumValues(ingresosMes),
          breakdown: buildBreakdown(ingresosMes),
        },
        ingresosSemana: {
          total: sumValues(ingresosSemana),
          breakdown: buildBreakdown(ingresosSemana),
        },
        gastosMes: economy?.gastos?.mes ?? 0,
        balanceMensual: economy?.balanceMensual ?? 0,
        proyeccion: {
          mes: economy?.proyeccion?.mes ?? sumValues(ingresosMes),
          semana: economy?.proyeccion?.semana ?? sumValues(ingresosSemana),
        },
      };
    },
  });

function BreakdownList({ title, breakdown = [] }) {
  return (
    <View className="mt-4 gap-2">
      <Text className="text-white/60 text-xs uppercase tracking-[0.2em]">{title}</Text>
      {breakdown.map((item) => (
        <View key={item.estado} className="flex-row items-center justify-between">
          <Text className="text-white/80">{item.label}</Text>
          <Text className={`text-[16px] font-semibold ${statusColorMap[item.estado] || 'text-white'}`}>
            {formatCurrency(item.monto)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function KpiCard({ title, value, subtitle, children }) {
  return (
    <View className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <Text className="text-white/70 text-[14px] uppercase tracking-[0.2em]">{title}</Text>
      <Text className="text-white text-[32px] font-extrabold mt-3">{value}</Text>
      {subtitle ? <Text className="text-white/50 mt-2">{subtitle}</Text> : null}
      {children}
    </View>
  );
}

export default function EconomiaScreen() {
  const { user, ready } = useAuth();

  const clubId = useMemo(() => {
    const parsed = Number(user?.clubId ?? user?.club?.club_id ?? user?.club?.id);
    return Number.isFinite(parsed) ? parsed : null;
  }, [user?.club?.club_id, user?.club?.id, user?.clubId]);

  const {
    data: economy,
    isPending,
    isFetching,
    isError,
    error,
  } = useQuery(getEconomyQueryOptions({ clubId, enabled: ready }));

  const showLoader = !ready || isPending;
  const errorMessage = !clubId
    ? 'No encontramos el club asociado a tu perfil.'
    : isError
      ? error?.message || 'No se pudo cargar la economía del club.'
      : '';

  return (
    <View className="flex-1">
      <View className="py-6">
        <Text className="text-white text-[36px] font-extrabold tracking-tight">Economía</Text>
        <Text className="text-white/60 mt-1">Resumen económico del club</Text>
      </View>

      {errorMessage ? (
        <Text className="text-red-300 mb-4">{errorMessage}</Text>
      ) : null}

      <View className="gap-6">
        <KpiCard
          title="Ingresos del mes"
          value={showLoader ? 'Cargando...' : formatCurrency(economy?.ingresosMes?.total)}
          subtitle={isFetching && !showLoader ? 'Actualizando…' : ''}
        >
          <BreakdownList title="Por estado" breakdown={economy?.ingresosMes?.breakdown} />
        </KpiCard>

        <KpiCard
          title="Ingresos de la semana"
          value={showLoader ? 'Cargando...' : formatCurrency(economy?.ingresosSemana?.total)}
          subtitle={isFetching && !showLoader ? 'Actualizando…' : ''}
        >
          <BreakdownList title="Por estado" breakdown={economy?.ingresosSemana?.breakdown} />
        </KpiCard>

        <View className="flex-row gap-4 flex-wrap">
          <View className="flex-1 min-w-[240px]">
            <KpiCard
              title="Gastos del mes"
              value={showLoader ? 'Cargando...' : formatCurrency(economy?.gastosMes)}
              subtitle="Incluye egresos registrados en mis gastos"
            />
          </View>
          <View className="flex-1 min-w-[240px]">
            <KpiCard
              title="Balance mensual"
              value={showLoader ? 'Cargando...' : formatCurrency(economy?.balanceMensual)}
              subtitle="Ingresos proyectados - gastos"
            />
          </View>
        </View>

        <KpiCard
          title="Proyección"
          value={showLoader ? 'Cargando...' : formatCurrency(economy?.proyeccion?.mes)}
          subtitle="Estimación basada en los ingresos actuales"
        >
          <View className="mt-4 gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-white/80">Proyección semanal</Text>
              <Text className="text-white font-semibold">
                {showLoader ? 'Cargando...' : formatCurrency(economy?.proyeccion?.semana)}
              </Text>
            </View>
          </View>
        </KpiCard>
      </View>

      {showLoader && !errorMessage ? (
        <View className="mt-4 flex-row items-center gap-2">
          <ActivityIndicator color="#e2e8f0" />
          <Text className="text-white/70">Preparando tu resumen...</Text>
        </View>
      ) : null}
    </View>
  );
}
