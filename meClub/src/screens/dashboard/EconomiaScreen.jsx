import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { useMutation, useQuery, useQueryClient, queryOptions } from '@tanstack/react-query';
import Card from '../../components/Card';
import CardTitle from '../../components/CardTitle';
import {
  createClubExpense,
  deleteClubExpense,
  getClubEconomy,
  listClubExpenses,
  updateClubExpense,
} from '../../lib/api';
import { useAuth } from '../../features/auth/useAuth';
import Svg, { Rect, Path, Text as SvgText } from 'react-native-svg';

const statusLabelMap = {
  pagado: 'Pagado',
  senado: 'Señado',
  pendiente_pago: 'Pendiente',
};

const ECONOMY_STALE_TIME = 60 * 1000;
const EXPENSES_STALE_TIME = 30 * 1000;
const EXPENSES_PAGE_SIZE = 10;

const statusColorMap = {
  pagado: 'text-emerald-300',
  senado: 'text-amber-200',
  pendiente_pago: 'text-slate-100',
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

const getEconomyQueryOptions = ({ clubId, enabled }) =>
  queryOptions({
    queryKey: ['economia', clubId],
    enabled: !!clubId && enabled,
    queryFn: async () => getClubEconomy({ clubId }),
    staleTime: ECONOMY_STALE_TIME,
    select: (economy) => {
      const buildBreakdown = (source = {}) =>
        ['pagado', 'senado', 'pendiente_pago'].map((estado) => ({
          estado,
          label: statusLabelMap[estado] || estado,
          monto: source?.[estado] ?? 0,
        }));

      const sumByStates = (source = {}, estados = []) =>
        estados.reduce((acc, estado) => acc + (Number(source?.[estado]) || 0), 0);

      const formatMonthLabel = (value) => {
        if (!value) return '';
        const normalized =
          typeof value === 'string' && /^\d{4}-\d{2}$/.test(value.trim())
            ? `${value}-01`
            : value;
        const date = new Date(normalized);
        if (!Number.isNaN(date.getTime())) {
          return date.toLocaleDateString('es-AR', { month: 'short' });
        }
        return String(value);
      };

      const ingresosMes = economy?.ingresos?.mes ?? {};
      const ingresosSemana = economy?.ingresos?.semana ?? {};

      const estadosReales = ['pagado', 'senado'];
      const estadosProyectados = ['pagado', 'senado', 'pendiente_pago'];

      const ingresosMensualesReales = sumByStates(ingresosMes, estadosReales);
      const ingresosMensualesProyectados = sumByStates(ingresosMes, estadosProyectados);
      const ingresosSemanalesReales = sumByStates(ingresosSemana, estadosReales);
      const ingresosSemanalesProyectados = sumByStates(ingresosSemana, estadosProyectados);

      const normalizeMonthlyHistory = () => {
        const history = Array.isArray(economy?.ingresosMensualesHistoricos)
          ? economy.ingresosMensualesHistoricos
          : [];

        const parsed = history
          .map((item, index) => {
            const rawPeriod =
              item.periodo || item.period || item.fecha || item.mes || item.month || item.label;
            const label = formatMonthLabel(rawPeriod) || item.label || `M${index + 1}`;
            const value = Number(item.total ?? item.value ?? item.monto) || 0;
            return label ? { label, value, rawPeriod: rawPeriod || String(index) } : null;
          })
          .filter(Boolean);

        if (parsed.length) return parsed;

        const monthsBack = 6;
        const now = new Date();
        const seedValue = ingresosMensualesReales || ingresosMensualesProyectados || 0;
        const base = seedValue || 8000;
        const target = ingresosMensualesProyectados || base * 1.1;
        const step = (target - base) / Math.max(1, monthsBack - 1);

        return Array.from({ length: monthsBack }, (_, idx) => {
          const monthDate = new Date(
            now.getFullYear(),
            now.getMonth() - (monthsBack - idx - 1),
            1
          );
          const label = monthDate.toLocaleDateString('es-AR', { month: 'short' });
          const value = Math.max(0, Math.round(base + step * idx));
          return { label, value, rawPeriod: monthDate.toISOString() };
        });
      };

      return {
        ingresosMes: {
          total: ingresosMensualesReales,
          projected: ingresosMensualesProyectados,
          breakdown: buildBreakdown(ingresosMes),
        },
        ingresosSemana: {
          total: ingresosSemanalesReales,
          projected: ingresosSemanalesProyectados,
          breakdown: buildBreakdown(ingresosSemana),
        },
        gastosMes: economy?.gastos?.mes ?? economy?.gastos ?? 0,
        gastosSemana: economy?.gastos?.semana ?? 0,
        balanceMensual:
          economy?.balanceMensual ??
          (ingresosMensualesReales || 0) - (economy?.gastos?.mes ?? economy?.gastos ?? 0),
        balanceSemanal:
          economy?.balanceSemanal ??
          (ingresosSemanalesReales || 0) - (economy?.gastos?.semana ?? 0),
        proyeccion: {
          mes: ingresosMensualesProyectados,
          semana: ingresosSemanalesProyectados,
        },
        reservas: economy?.reservas ?? { mes: 0, semana: 0 },
        ingresosMensualesHistoricos: normalizeMonthlyHistory(),
      };
    },
  });

function BreakdownList({ title, breakdown = [], loading }) {
  if (loading) {
    return (
      <View className="mt-4 gap-2">
        <View className="h-3 w-32 rounded-full bg-white/10" />
        <View className="h-4 w-full rounded-full bg-white/10" />
        <View className="h-4 w-[88%] rounded-full bg-white/10" />
        <View className="h-4 w-[70%] rounded-full bg-white/10" />
      </View>
    );
  }

  return (
    <View className="mt-4 gap-2" accessibilityLabel={title} accessible>
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

function MetricCard({ title, value, subtitle, children, loading }) {
  return (
    <Card
      className="flex-1 min-w-[240px]"
      accessibilityLabel={`${title} ${value}${subtitle ? `, ${subtitle}` : ''}`}
      accessible
    >
      <CardTitle colorClass="text-white/80">{title}</CardTitle>
      <View className="mt-3 gap-2">
        {loading ? (
          <View className="h-9 w-32 rounded-lg bg-white/10" />
        ) : (
          <Text className="text-white text-[32px] font-extrabold mt-1">{value}</Text>
        )}
        {subtitle ? <Text className="text-white/50">{subtitle}</Text> : null}
        {children}
      </View>
    </Card>
  );
}

function BarChart({ data = [], height = 140 }) {
  if (!data.length) return (
    <View className="h-[140px] justify-center items-center">
      <Text className="text-white/40 text-xs">Sin datos</Text>
    </View>
  );

  const maxValue = Math.max(...data.map((d) => d.value || 0), 1);
  const barWidth = 36;
  const gap = 12;
  const padding = { top: 8, right: gap, bottom: 28, left: gap };
  const chartWidth = data.length * (barWidth + gap) + padding.left + padding.right - gap;
  const chartHeight = height - padding.top - padding.bottom;

  const formatBarLabel = (item) => {
    if (item.label) return item.label;

    const formatDate = (rawDate) => {
      if (!rawDate) return '';
      const date = new Date(rawDate);
      if (Number.isNaN(date.getTime())) return String(rawDate);
      return date.toLocaleDateString('es-AR', { month: 'short', day: 'numeric' });
    };

    const startDate =
      item.fecha || item.date || item.startDate || item.fecha_inicio || item.inicio || item.desde;
    const endDate = item.endDate || item.fecha_fin || item.fin || item.hasta;

    if (startDate && endDate) {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }

    return formatDate(startDate) || formatDate(endDate) || '';
  };

  return (
    <Svg height={height} width={chartWidth} viewBox={`0 0 ${chartWidth} ${height}`}>
      {data.map((item, index) => {
        const barHeight = Math.max((Number(item.value) / maxValue) * chartHeight, 4);
        const x = padding.left + index * (barWidth + gap);
        const y = padding.top + (chartHeight - barHeight);
        const label = formatBarLabel(item);
        return (
          <React.Fragment key={`${label || index}`}>
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={8}
              fill="#38bdf8"
            />
            {label ? (
              <SvgText
                x={x + barWidth / 2}
                y={height - padding.bottom / 2}
                fill="white"
                fontSize="12"
                textAnchor="middle"
              >
                {label}
              </SvgText>
            ) : null}
          </>
        );
      })}
    </Svg>
  );
}

function AreaChart({ data = [], height = 160 }) {
  if (!data.length) {
    return (
      <View className="h-[160px] justify-center items-center">
        <Text className="text-white/40 text-xs">Sin datos</Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value || 0), 1);
  const padding = { top: 12, right: 16, bottom: 32, left: 16 };
  const minInnerWidth = 180;
  const innerWidth = Math.max(minInnerWidth, (data.length - 1) * 56);
  const chartWidth = innerWidth + padding.left + padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const baselineY = padding.top + chartHeight;
  const step = data.length > 1 ? innerWidth / (data.length - 1) : 0;

  const points = data.map((item, index) => {
    const x = padding.left + index * step;
    const y =
      padding.top + chartHeight - (Number(item.value) / maxValue) * chartHeight;
    return { x, y, label: item.label };
  });

  const pointPath = points.map((point) => `${point.x},${point.y}`).join(' L ');
  const areaPath = `M${padding.left},${baselineY} L${pointPath} L${padding.left + innerWidth},${baselineY} Z`;

  return (
    <Svg height={height} width={chartWidth} viewBox={`0 0 ${chartWidth} ${height}`}>
      <Path d={areaPath} fill="rgba(34,211,238,0.15)" stroke="#22d3ee" strokeWidth={2} />
      <Path
        d={`M${pointPath}`}
        fill="none"
        stroke="#22d3ee"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d={`M${pointPath}`} fill="none" stroke="#67e8f9" strokeWidth={5} opacity={0.12} />
      <Path
        d={`M${padding.left},${baselineY} L${padding.left + innerWidth},${baselineY}`}
        stroke="#94a3b8"
        strokeWidth={1}
        opacity={0.35}
      />
      {points.map((point, index) => (
        <SvgText
          key={`${point.label || index}-label`}
          x={point.x}
          y={height - padding.bottom / 2}
          fill="white"
          fontSize="12"
          textAnchor="middle"
        >
          {point.label}
        </SvgText>
      ))}
    </Svg>
  );
}

function ExpenseModal({ visible, onClose, onSubmit, loading, initialValue }) {
  const [categoria, setCategoria] = useState(initialValue?.categoria || '');
  const [descripcion, setDescripcion] = useState(initialValue?.descripcion || '');
  const [monto, setMonto] = useState(initialValue?.monto?.toString() || '');

  useEffect(() => {
    setCategoria(initialValue?.categoria || '');
    setDescripcion(initialValue?.descripcion || '');
    setMonto(initialValue?.monto?.toString() || '');
  }, [initialValue]);

  const handleSubmit = () => {
    const parsedMonto = Number(monto);
    if (!categoria || Number.isNaN(parsedMonto)) return;
    onSubmit({ categoria, descripcion, monto: parsedMonto });
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/70 items-center justify-center px-4">
        <Card className="w-full max-w-xl">
          <CardTitle colorClass="text-white">{initialValue ? 'Editar gasto' : 'Nuevo gasto'}</CardTitle>
          <View className="mt-4 gap-4">
            <View>
              <Text className="text-white/70 mb-2">Categoría</Text>
              <TextInput
                value={categoria}
                onChangeText={setCategoria}
                placeholder="Ej. Servicios"
                placeholderTextColor="rgba(255,255,255,0.4)"
                className="bg-white/10 rounded-xl px-4 py-3 text-white"
                accessibilityLabel="Categoría de gasto"
              />
            </View>
            <View>
              <Text className="text-white/70 mb-2">Descripción</Text>
              <TextInput
                value={descripcion}
                onChangeText={setDescripcion}
                placeholder="Detalle opcional"
                placeholderTextColor="rgba(255,255,255,0.4)"
                className="bg-white/10 rounded-xl px-4 py-3 text-white"
                accessibilityLabel="Descripción del gasto"
              />
            </View>
            <View>
              <Text className="text-white/70 mb-2">Monto</Text>
              <TextInput
                value={monto}
                onChangeText={setMonto}
                keyboardType="numeric"
                placeholder="$0"
                placeholderTextColor="rgba(255,255,255,0.4)"
                className="bg-white/10 rounded-xl px-4 py-3 text-white"
                accessibilityLabel="Monto del gasto"
              />
            </View>
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={onClose}
                className="flex-1 rounded-xl bg-white/10 py-3 items-center"
                accessibilityRole="button"
              >
                <Text className="text-white font-semibold">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading}
                className="flex-1 rounded-xl bg-emerald-500 py-3 items-center"
                accessibilityRole="button"
              >
                <Text className="text-white font-semibold">
                  {loading ? 'Guardando...' : initialValue ? 'Actualizar' : 'Agregar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>
      </View>
    </Modal>
  );
}

function ExpenseTable({ expenses = [], onEdit, onDelete, loading }) {
  if (loading) {
    return (
      <View className="gap-3">
        {[0, 1, 2].map((key) => (
          <View key={key} className="h-14 rounded-xl bg-white/10" />
        ))}
      </View>
    );
  }

  if (!expenses.length) {
    return <Text className="text-white/60">Aún no registraste gastos.</Text>;
  }

  return (
    <View className="gap-3">
      {expenses.map((expense) => (
        <View
          key={expense.id}
          className="flex-row items-center justify-between rounded-xl bg-white/5 border border-white/5 px-4 py-3"
          accessibilityLabel={`${expense.categoria} ${formatCurrency(expense.monto)}`}
        >
          <View className="flex-1">
            <Text className="text-white font-semibold">{expense.categoria}</Text>
            {expense.descripcion ? <Text className="text-white/60 text-sm">{expense.descripcion}</Text> : null}
            <Text className="text-white/70 text-xs mt-1">{expense.fecha ?? 'Sin fecha'}</Text>
          </View>
          <View className="items-end gap-2 ml-4">
            <Text className="text-white font-bold">{formatCurrency(expense.monto)}</Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => onEdit(expense)}
                accessibilityRole="button"
                accessibilityLabel="Editar gasto"
                className="rounded-lg bg-white/10 px-3 py-2"
              >
                <Text className="text-white">Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDelete(expense)}
                accessibilityRole="button"
                accessibilityLabel="Eliminar gasto"
                className="rounded-lg bg-red-500/90 px-3 py-2"
              >
                <Text className="text-white">Borrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function EconomiaScreen() {
  const { user, ready } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseToDelete, setExpenseToDelete] = useState(null);

  const clubId = useMemo(() => {
    const parsed = Number(user?.clubId ?? user?.club?.club_id ?? user?.club?.id);
    return Number.isFinite(parsed) ? parsed : null;
  }, [user?.club?.club_id, user?.club?.id, user?.clubId]);

  const economyQuery = useQuery(getEconomyQueryOptions({ clubId, enabled: ready }));

  const expenseQuery = useQuery({
    queryKey: ['expenses', clubId, page, EXPENSES_PAGE_SIZE],
    enabled: !!clubId && ready,
    queryFn: () => listClubExpenses({ page, limit: EXPENSES_PAGE_SIZE }),
    staleTime: EXPENSES_STALE_TIME,
    keepPreviousData: true,
  });

  const invalidateExpenses = () => queryClient.invalidateQueries({ queryKey: ['expenses', clubId] });
  const invalidateEconomy = () => queryClient.invalidateQueries({ queryKey: ['economia', clubId] });

  const createExpense = useMutation({
    mutationFn: (payload) => createClubExpense(payload),
    onSuccess: () => {
      setPage(1);
      invalidateExpenses();
      invalidateEconomy();
    },
  });

  const updateExpense = useMutation({
    mutationFn: ({ id, ...updates }) => updateClubExpense(id, updates),
    onSuccess: () => {
      invalidateExpenses();
      invalidateEconomy();
    },
  });

  const deleteExpense = useMutation({
    mutationFn: (expenseId) => deleteClubExpense(expenseId),
    onSuccess: () => {
      invalidateExpenses();
      invalidateEconomy();
      setExpenseToDelete(null);
      if ((expenseQuery.data?.gastos?.length ?? 0) <= 1 && page > 1) {
        setPage((prev) => Math.max(1, prev - 1));
      }
    },
  });

  const { data: economy, isPending, isFetching, isError, error } = economyQuery;
  const showLoader = !ready || isPending;
  const errorMessage = !clubId
    ? 'No encontramos el club asociado a tu perfil.'
    : isError
      ? error?.message || 'No se pudo cargar la economía del club.'
      : '';

  const ingresosMensuales = economy?.ingresosMes;
  const ingresosSemanales = economy?.ingresosSemana;
  const ingresosMensualesHistoricos = economy?.ingresosMensualesHistoricos ?? [];
  const gastosMensuales = economy?.gastosMes;
  const gastosSemanales = economy?.gastosSemana;
  const reservasMensuales = economy?.reservas?.mes;
  const reservasSemanales = economy?.reservas?.semana;
  const balanceMensual = economy?.balanceMensual;
  const balanceSemanal = economy?.balanceSemanal;

  const expenseLoading = expenseQuery.isPending || expenseQuery.isFetching;
  const expenseErrorMessage = expenseQuery.isError
    ? expenseQuery.error?.message || 'No se pudieron cargar tus gastos.'
    : '';
  const recentExpenses = useMemo(() => {
    const expenses = expenseQuery.data?.gastos ?? [];
    return expenses.slice(0, 3);
  }, [expenseQuery.data?.gastos]);
  const expensePagination = expenseQuery.data?.meta ?? {
    page,
    limit: EXPENSES_PAGE_SIZE,
    totalPaginas: 1,
    total: expenseQuery.data?.gastos?.length ?? 0,
  };
  const canGoPrevPage = expensePagination.page > 1;
  const canGoNextPage = expensePagination.page < (expensePagination.totalPaginas || 1);

  const handleSaveExpense = (payload) => {
    if (editingExpense) {
      updateExpense.mutate({ id: editingExpense.id, ...payload }, {
        onSuccess: () => {
          setShowExpenseModal(false);
          setEditingExpense(null);
        },
      });
      return;
    }

    createExpense.mutate(payload, {
      onSuccess: () => {
        setShowExpenseModal(false);
        setEditingExpense(null);
      },
    });
  };

  const handleDeleteExpense = () => {
    if (!expenseToDelete) return;
    deleteExpense.mutate(expenseToDelete.id);
  };

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="py-6">
        <Text className="text-white text-[36px] font-extrabold tracking-tight" accessibilityRole="header">
          Economía
        </Text>
        <Text className="text-white/60 mt-1">Resumen económico del club</Text>
      </View>

      {errorMessage ? <Text className="text-red-300 mb-4">{errorMessage}</Text> : null}

      <View className="gap-4">
        <View className="flex-row flex-wrap gap-4">
          <MetricCard
            title="Ingresos"
            value={showLoader ? 'Cargando…' : formatCurrency(ingresosMensuales?.total)}
            subtitle={showLoader ? '' : `Semanal: ${formatCurrency(ingresosSemanales?.total)}`}
            loading={showLoader}
          >
            {!showLoader ? (
              <Text className="text-white/60">
                ingresos proyectados {formatCurrency(ingresosMensuales?.projected)}
              </Text>
            ) : null}
            <BreakdownList
              title="Detalle mensual"
              breakdown={ingresosMensuales?.breakdown}
              loading={showLoader}
            />
            <BreakdownList
              title="Detalle semanal"
              breakdown={ingresosSemanales?.breakdown}
              loading={showLoader}
            />
          </MetricCard>

          <MetricCard
            title="Gastos registrados"
            value={showLoader ? 'Cargando…' : formatCurrency(gastosMensuales)}
            subtitle={showLoader ? '' : `Semanal: ${formatCurrency(gastosSemanales)}`}
            loading={showLoader}
          >
            <View className="gap-2 mt-2">
              {expenseLoading ? (
                <View className="gap-2" accessibilityLabel="Cargando gastos recientes" accessible>
                  <View className="h-3 w-40 rounded-full bg-white/10" />
                  <View className="h-3 w-48 rounded-full bg-white/10" />
                  <View className="h-3 w-44 rounded-full bg-white/10" />
                </View>
              ) : recentExpenses.length ? (
                <View className="gap-1" accessibilityLabel="Gastos recientes" accessible>
                  {recentExpenses.map((expense) => (
                    <Text key={expense.id} className="text-white/60 text-sm">
                      {expense.descripcion || expense.categoria}: {formatCurrency(expense.monto)}
                    </Text>
                  ))}
                </View>
              ) : (
                <Text className="text-white/40 text-sm">Sin gastos recientes</Text>
              )}
            </View>
          </MetricCard>

          <MetricCard
            title="Reservas"
            value={showLoader ? 'Cargando…' : (reservasMensuales ?? 0)}
            subtitle={showLoader ? '' : 'Total mensual'}
            loading={showLoader}
          >
            {!showLoader ? (
              <View
                className="gap-1"
                accessibilityLabel={`Reservas del mes ${reservasMensuales ?? 0}, reservas de la semana ${
                  reservasSemanales ?? 0
                }`}
                accessible
              >
                <Text className="text-white/60">
                  Reservas del mes:{' '}
                  <Text className="text-white font-semibold">{reservasMensuales ?? 0}</Text>
                </Text>
                <Text className="text-white/60">
                  Reservas de la semana:{' '}
                  <Text className="text-white font-semibold">{reservasSemanales ?? 0}</Text>
                </Text>
              </View>
            ) : null}
          </MetricCard>

          <MetricCard
            title="Balance"
            value={showLoader ? 'Cargando…' : formatCurrency(balanceMensual)}
            subtitle={showLoader ? '' : `Balance semanal: ${formatCurrency(balanceSemanal)}`}
            loading={showLoader}
          >
            {!showLoader ? (
              <View className="gap-1">
                <Text className="text-white/70">Proyección mensual: {formatCurrency(economy?.proyeccion?.mes)}</Text>
                <Text className="text-white/70">Proyección semanal: {formatCurrency(economy?.proyeccion?.semana)}</Text>
              </View>
            ) : null}
          </MetricCard>
        </View>

        <View className="flex-row flex-wrap gap-4">
          <Card className="flex-1 min-w-[320px]" accessibilityRole="summary">
            <View className="flex-row items-center justify-between">
              <CardTitle colorClass="text-sky-200">Ingresos semanales</CardTitle>
              <Text className="text-white font-bold">{formatCurrency(economy?.ingresosSemana?.total)}</Text>
            </View>
            <View className="mt-4">
              {showLoader ? (
                <View className="h-[140px] rounded-2xl bg-white/10" />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <BarChart
                    data={economy?.ingresosSemana?.breakdown?.map((item) => ({
                      label:
                        item.label ||
                        (() => {
                          const formatDate = (value) => {
                            if (!value) return '';
                            const date = new Date(value);
                            if (Number.isNaN(date.getTime())) return String(value);
                            return date.toLocaleDateString('es-AR', { weekday: 'short' });
                          };

                          const startDate =
                            item.fecha || item.date || item.startDate || item.fecha_inicio;
                          const endDate = item.endDate || item.fecha_fin;

                          if (startDate && endDate) {
                            return `${formatDate(startDate)}-${formatDate(endDate)}`;
                          }

                          return formatDate(startDate) || formatDate(endDate) || '';
                        })(),
                      value: item.monto,
                    }))}
                  />
                </ScrollView>
              )}
            </View>
          </Card>

          <Card className="flex-1 min-w-[320px]" accessibilityRole="summary">
            <View className="flex-row items-center justify-between">
              <CardTitle colorClass="text-emerald-200">Ingresos mensuales</CardTitle>
              <Text className="text-white font-bold">{formatCurrency(economy?.ingresosMes?.total)}</Text>
            </View>
            <View className="mt-4">
              {showLoader ? (
                <View className="h-[160px] rounded-2xl bg-white/10" />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <AreaChart
                    data={ingresosMensualesHistoricos}
                  />
                </ScrollView>
              )}
            </View>
          </Card>
        </View>

        <Card className="w-full">
          <View className="flex-row items-center justify-between mb-3">
            <CardTitle colorClass="text-white">Mis gastos</CardTitle>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => {
                  setEditingExpense(null);
                  setShowExpenseModal(true);
                }}
                className="rounded-xl bg-emerald-500 px-4 py-3"
                accessibilityRole="button"
                accessibilityLabel="Agregar gasto"
              >
                <Text className="text-white font-semibold">Agregar gasto</Text>
              </TouchableOpacity>
              {expenseToDelete ? (
                <TouchableOpacity
                  onPress={handleDeleteExpense}
                  disabled={deleteExpense.isPending}
                  className="rounded-xl bg-red-500/90 px-4 py-3"
                  accessibilityRole="button"
                  accessibilityLabel="Confirmar borrado"
                >
                  <Text className="text-white font-semibold">
                    {deleteExpense.isPending ? 'Eliminando…' : 'Confirmar borrado'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          {expenseErrorMessage ? (
            <View className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
              <Text className="text-red-100 mb-2">{expenseErrorMessage}</Text>
              <TouchableOpacity
                onPress={() => expenseQuery.refetch()}
                accessibilityRole="button"
                className="self-start rounded-lg bg-white/10 px-3 py-2"
              >
                <Text className="text-white">Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <ExpenseTable
            expenses={expenseQuery.data?.gastos ?? []}
            onEdit={(expense) => {
              setEditingExpense(expense);
              setShowExpenseModal(true);
            }}
            onDelete={setExpenseToDelete}
            loading={expenseLoading}
          />
          {expenseToDelete ? (
            <Text className="text-red-300 mt-3">
              Estás por borrar "{expenseToDelete.categoria}" por {formatCurrency(expenseToDelete.monto)}.
            </Text>
          ) : null}
          {!expenseErrorMessage ? (
            <View className="mt-4 flex-row items-center justify-between">
              <Text className="text-white/60 text-sm">
                Página {expensePagination.page} de {expensePagination.totalPaginas || 1} ·{' '}
                {expensePagination.total} gastos
              </Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={!canGoPrevPage || expenseQuery.isFetching}
                  className={`rounded-lg px-3 py-2 ${
                    !canGoPrevPage || expenseQuery.isFetching ? 'bg-white/5' : 'bg-white/10'
                  }`}
                  accessibilityRole="button"
                  accessibilityLabel="Página anterior"
                >
                  <Text className="text-white">Anterior</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPage((prev) => prev + 1)}
                  disabled={!canGoNextPage || expenseQuery.isFetching}
                  className={`rounded-lg px-3 py-2 ${
                    !canGoNextPage || expenseQuery.isFetching ? 'bg-white/5' : 'bg-white/10'
                  }`}
                  accessibilityRole="button"
                  accessibilityLabel="Página siguiente"
                >
                  <Text className="text-white">Siguiente</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          {expenseQuery.isFetching && !expenseQuery.isPending ? (
            <Text className="text-white/60 text-xs mt-2">Actualizando lista de gastos…</Text>
          ) : null}
        </Card>
      </View>

      {showLoader && !errorMessage ? (
        <View className="mt-4 flex-row items-center gap-2" accessible accessibilityLiveRegion="polite">
          <ActivityIndicator color="#e2e8f0" />
          <Text className="text-white/70">Preparando tu resumen...</Text>
        </View>
      ) : null}

      <ExpenseModal
        visible={showExpenseModal}
        onClose={() => {
          setShowExpenseModal(false);
          setEditingExpense(null);
        }}
        onSubmit={handleSaveExpense}
        loading={createExpense.isPending || updateExpense.isPending}
        initialValue={editingExpense}
      />
    </ScrollView>
  );
}
