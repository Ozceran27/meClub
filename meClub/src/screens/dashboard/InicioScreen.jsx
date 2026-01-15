import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/Card';
import CardTitle from '../../components/CardTitle';
import MonthlyFlowChart from '../../components/MonthlyFlowChart';
import ScreenHeader from '../../components/ScreenHeader';

const titleColors = ['text-emerald-300', 'text-mc-info', 'text-mc-warn', 'text-mc-purpleAccent'];
const getTitleColor = (index) => titleColors[index % titleColors.length];

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

const normalizeAmount = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const normalizeMonthlyEconomyForChart = (source = []) => {
  if (!Array.isArray(source)) return [];

  const getIngresos = (rawIngresos) => {
    if (rawIngresos && typeof rawIngresos === 'object' && !Array.isArray(rawIngresos)) {
      const paid = normalizeAmount(rawIngresos.pagado ?? rawIngresos.pago, 0);
      const deposit = normalizeAmount(
        rawIngresos.senado ?? rawIngresos.señado ?? rawIngresos.senadoPago ?? rawIngresos.deposito,
        0
      );
      return {
        pagado: paid,
        senado: deposit,
        pendiente: normalizeAmount(rawIngresos.pendiente_pago ?? rawIngresos.pendiente ?? rawIngresos.pending, 0),
      };
    }

    const fallback = normalizeAmount(rawIngresos, 0);
    return { pagado: fallback, senado: 0, pendiente: 0 };
  };

  return source.map((item) => {
    const ingresosDetalle = getIngresos(item?.ingresos ?? item?.income ?? item?.ingresosMes);
    const ingresos = ingresosDetalle.pagado + ingresosDetalle.senado;
    const gastos = normalizeAmount(item?.gastos ?? item?.expenses ?? item?.gastosMes, 0);
    const balance = ingresos - gastos;

    return {
      ...item,
      ingresos,
      gastos,
      balance,
      proyeccion: {
        ingresos: ingresos + ingresosDetalle.pendiente,
        gastos,
        balance: ingresos + ingresosDetalle.pendiente - gastos,
      },
    };
  });
};

export default function InicioScreen({ summary = {}, summaryLoading = false, summaryError = '', firstName, today, go }) {
  const courtTypesText = Array.isArray(summary.courtTypes) && summary.courtTypes.length > 0
    ? summary.courtTypes
        .map((item) => {
          const label = item?.etiqueta || item?.label || 'Otro';
          const total = item?.total ?? 0;
          return `${label} (${total})`;
        })
        .join(' | ')
    : 'Sin canchas registradas';

  const courtsAvailable = summary.courtsAvailable ?? 0;
  const courtsMaintenance = summary.courtsMaintenance ?? 0;
  const courtsInactive = summary.courtsInactive ?? 0;
  const courtsTotal = summary.courtsTotal ?? courtsAvailable + courtsMaintenance + courtsInactive;

  const reservasHoy = summary.reservasHoy ?? 0;
  const isHighDemand = reservasHoy > 6;
  const demandLabel = isHighDemand ? 'ALTA DEMANDA' : 'BAJA DEMANDA';
  const demandStyles = isHighDemand
    ? 'border-emerald-400/30 bg-emerald-500/10'
    : 'border-rose-400/30 bg-rose-500/10';
  const demandTextColor = isHighDemand ? 'text-emerald-100' : 'text-rose-100';
  const demandIconColor = isHighDemand ? '#A7F3D0' : '#FCA5A5';

  const hasWeatherTemp = Number.isFinite(summary.weatherTemp);
  const weatherTemp = hasWeatherTemp ? `${summary.weatherTemp}°` : '—';
  const weatherStatus = summary.weatherStatus || 'Clima no disponible';

  const ingresosMes = summary.ingresosMes || { pagado: 0, senado: 0, pendiente_pago: 0 };
  const ingresosRealesMes = normalizeAmount(
    summary.ingresosRealesMes ?? ingresosMes.pagado + ingresosMes.senado,
    0
  );
  const ingresosProyectadosMes = normalizeAmount(
    summary.ingresosProyectadosMes ??
      summary.proyeccionMes ??
      ingresosMes.pagado + ingresosMes.senado + ingresosMes.pendiente_pago,
    ingresosRealesMes
  );
  const gastosMes = normalizeAmount(summary.gastosMes, 0);
  const economiaMensualRaw = Array.isArray(summary.economiaMensual) ? summary.economiaMensual : [];
  const economiaMensual = normalizeMonthlyEconomyForChart(economiaMensualRaw);
  const economyErrorMessage = summaryError ? 'No pudimos cargar tu economía. Intentalo nuevamente.' : '';
  const showEconomyFallback = !!summaryError && !summaryLoading;

  return (
    <>
      <View className="gap-3">
        <View className="flex-row items-center justify-between gap-4">
          <View className="flex-1 min-w-[240px]">
            <View className="flex-row items-center gap-6">
              <ScreenHeader
                className="py-0 ml-6"
                title={
                  <>
                    Hola, <Text className="text-mc-warn">{firstName}</Text>
                  </>
                }
                subtitle={today}
              />
              <View className="flex-row items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5">
                <Ionicons name="partly-sunny-outline" size={20} color="#FDE68A" />
                <Text className="text-amber-100 text-[14px] font-semibold tracking-wide">{weatherTemp}</Text>
                <Text className="text-white/80 text-[14px]" numberOfLines={1}>
                  {weatherStatus}
                </Text>
              </View>
            </View>
          </View>

          <View
            className="flex-row items-center mr-10"
            accessibilityRole="text"
            accessibilityLabel="Indicador de demanda"
          >
            <View
              className={`flex-row items-center gap-2 rounded-full border px-3 py-1 ${demandStyles}`}
            >
              <Ionicons
                name={isHighDemand ? 'trending-up' : 'trending-down'}
                size={16}
                color={demandIconColor}
                accessibilityLabel="Demanda de reservas"
              />
              <Text className={`${demandTextColor} text-[12px] font-semibold tracking-wide`}>
                {demandLabel}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View className="gap-6">
        {/* fila 1 */}
        <View className="flex-row gap-6">
          <Card className="flex-1">
            <CardTitle colorClass={getTitleColor(1)}>MIS CANCHAS</CardTitle>
            <View className="mt-2">
              <Text className="text-[32px] font-extrabold leading-tight tracking-tight">
                <Text className="text-mc-warn">{courtsTotal}</Text>
                <Text className="text-white"> Canchas Total</Text>
              </Text>
            </View>
            <View className="mt-1 px-1">
              <Text
                className="text-white text-[14px] font-semibold"
                numberOfLines={1}
                ellipsizeMode="tail"
                accessibilityLabel="Tipos de cancha"
              >
                {courtTypesText}
              </Text>
            </View>
            <View className="mt-3 flex-row flex-wrap items-center gap-4">
              <View className="flex-row items-baseline gap-1">
                <Text className="text-emerald-300 text-[18px] font-semibold">
                  {summary.courtsAvailable ?? 0}
                </Text>
                <Text className="text-white/70 text-[14px]">disponibles</Text>
              </View>
              <View className="flex-row items-baseline gap-1">
                <Text className="text-amber-300 text-[16px] font-semibold">
                  {summary.courtsMaintenance ?? 0}
                </Text>
                <Text className="text-white/60 text-[14px]">en mantenimiento</Text>
              </View>
              <View className="flex-row items-baseline gap-1">
                <Text className="text-rose-300 text-[16px] font-semibold">
                  {summary.courtsInactive ?? 0}
                </Text>
                <Text className="text-white/60 text-[14px]">inactivas</Text>
              </View>
            </View>
            <Pressable
              onPress={() => go('mis-canchas')}
              className="self-center mt-4 items-center justify-center rounded-xl px-4 py-2 border border-sky-300/30 bg-sky-400/15 hover:bg-sky-400/25"
            >
              <Text className="text-sky-200 font-medium">VER CANCHAS</Text>
            </Pressable>
          </Card>

          <Card className="flex-1">
            <CardTitle colorClass={getTitleColor(0)}>RESERVAS</CardTitle>
            <View className="mt-2 flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
              <Text className="text-mc-warn text-[32px] font-bold leading-tight">
                {summary.reservasHoy ?? 0} <Text className="text-white">hoy</Text>
              </Text>
              <Text className="text-white/50 text-[20px] font-bold leading-tight">|</Text>
              <Text className="text-white text-[20px] font-bold leading-tight">
                <Text className="text-sky-300">{summary.reservasFinalizadasHoy ?? 0}</Text>{' '}
                <Text className="text-white">finalizada</Text>
              </Text>
              <Text className="text-white/50 text-[20px] font-bold leading-tight">|</Text>
              <Text className="text-white text-[20px] font-bold leading-tight">
                <Text className="text-emerald-300">{summary.reservasPagadasHoy ?? 0}</Text>{' '}
                <Text className="text-white">pagada</Text>
              </Text>
            </View>
            <View className="mt-3 gap-1">
              <Text className="text-white/70 text-[15px] leading-tight">
                <Text className="text-emerald-300 font-semibold">+{summary.reservasSemana ?? 0}</Text> esta
                semana
              </Text>
              <Text className="text-white/70 text-[15px] leading-tight">
                <Text className="text-emerald-300 font-semibold">+{summary.reservasMesActual ?? 0}</Text> este
                mes
              </Text>
            </View>
            <Pressable
              onPress={() => go('reservas')}
              className="self-center mt-4 items-center justify-center rounded-xl px-4 py-2 border border-sky-300/30 bg-sky-400/15 hover:bg-sky-400/25"
            >
              <Text className="text-sky-200 font-medium">VER RESERVAS</Text>
            </Pressable>
          </Card>
        </View>

        {/* fila 2 */}
        <View className="flex-row gap-6">
          <Card className="flex-1">
            <CardTitle colorClass={getTitleColor(3)}>ECONOMÍA</CardTitle>
            <View className="mt-2 gap-2">
              {summaryLoading ? (
                <>
                  <View className="h-8 w-48 rounded-lg bg-white/10" />
                  <View className="h-5 w-60 rounded-lg bg-white/5" />
                </>
              ) : showEconomyFallback ? (
                <Text className="text-white/70 text-[15px]">{economyErrorMessage}</Text>
              ) : (
                <>
                  <Text className="text-white text-[24px] font-extrabold leading-tight">
                    <Text className="text-white">Ingresos del mes: </Text>
                      <Text className="text-mc-warn">{'+'}{formatCurrency(ingresosRealesMes)}</Text>
                  </Text>
                  <View className="mt-3 gap-1">
                    <Text className="text-white text-[15px] leading-tight font-semibold">
                      Proyectado:{' '}
                      <Text className="text-emerald-300 text-[15px] leading-tight font-semibold"> 
                        {formatCurrency(ingresosProyectadosMes)}
                      </Text>
                    </Text>
                    <Text className="text-white text-[15px] leading-tight font-semibold">
                      Gastos:{' '}
                      <Text className="text-rose-300 text-[15px] leading-tight font-semibold">
                       {'-'}{formatCurrency(gastosMes)}
                      </Text>
                    </Text>
                  </View>
                </>
              )}
            </View>
            <View className="mt-4 min-h-[120px]">
              <MonthlyFlowChart
                data={economiaMensual}
                loading={summaryLoading}
                error={economyErrorMessage}
                height={160}
              />
            </View>
          </Card>

          <Card className="flex-1">
            <CardTitle colorClass={getTitleColor(1)}>PRÓXIMO EVENTO</CardTitle>
            <Text className="text-white text-[28px] mt-2 font-semibold">Torneo de Primavera</Text>
            <Text className="text-white/60 mt-2">martes, 30 de abril de 2024</Text>
          </Card>
        </View>

        {/* fila 3 */}
        <View className="flex-row gap-6">
          <Card className="flex-1">
            <CardTitle colorClass={getTitleColor(0)}>EVENTOS</CardTitle>
            <View className="mt-3 flex-row items-center justify-between">
              <Text className="text-white text-[24px] font-semibold">meEquipo</Text>
              <Ionicons name="chevron-forward" size={20} color="#9FB3C8" />
            </View>
          </Card>

          <Card className="flex-1">
            <CardTitle colorClass={getTitleColor(3)}>EVENTOS</CardTitle>
            <View className="mt-3 flex-row items-center justify-between">
              <Text className="text-white text-[24px] font-semibold">Ranking</Text>
              <Ionicons name="chevron-forward" size={20} color="#9FB3C8" />
            </View>
          </Card>
        </View>
      </View>
    </>
  );
}
