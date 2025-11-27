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
import Svg, { Rect, Path } from 'react-native-svg';

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
        reservas: economy?.reservas ?? { mes: 0, semana: 0 },
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
    <Card className="flex-1 min-w-[240px]" accessibilityLabel={`${title} ${value}`} accessible>
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
  const chartWidth = data.length * (barWidth + gap) + gap;

  return (
    <Svg height={height} width={chartWidth} viewBox={`0 0 ${chartWidth} ${height}`}>
      {data.map((item, index) => {
        const barHeight = Math.max((Number(item.value) / maxValue) * (height - 32), 4);
        const x = gap + index * (barWidth + gap);
        const y = height - barHeight - 16;
        return (
          <Rect
            key={item.label}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={8}
            fill="#38bdf8"
          />
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
  const width = 260;
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data.map((item, index) => {
    const x = index * step;
    const y = height - (Number(item.value) / maxValue) * (height - 24) - 12;
    return `${x},${y}`;
  });
  const pathD = `M0,${height} L${points.join(' L ')} L${width},${height} Z`;

  return (
    <Svg height={height} width={width} viewBox={`0 0 ${width} ${height}`}>
      <Path d={pathD} fill="rgba(34,211,238,0.15)" stroke="#22d3ee" strokeWidth={2} />
      <Path
        d={`M${points.join(' L ')}`}
        fill="none"
        stroke="#22d3ee"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d={`M${points.join(' L ')}`} fill="none" stroke="#67e8f9" strokeWidth={5} opacity={0.12} />
    </Svg>
  );
}

function FilterToggle({ value, onChange }) {
  const options = [
    { label: 'Semana', value: 'semana' },
    { label: 'Mes', value: 'mes' },
  ];

  return (
    <View className="flex-row bg-white/5 border border-white/10 rounded-full p-1" accessible accessibilityRole="tablist">
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option.value }}
          onPress={() => onChange(option.value)}
          className={`px-4 py-2 rounded-full ${
            value === option.value ? 'bg-white/20' : 'bg-transparent'
          }`}
        >
          <Text className="text-white font-semibold">{option.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
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
  const [periodo, setPeriodo] = useState('mes');
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

  const ingresosSeleccionados = periodo === 'mes' ? economy?.ingresosMes : economy?.ingresosSemana;
  const totalReservas = periodo === 'mes' ? economy?.reservas?.mes : economy?.reservas?.semana;

  const expenseLoading = expenseQuery.isPending || expenseQuery.isFetching;
  const expenseErrorMessage = expenseQuery.isError
    ? expenseQuery.error?.message || 'No se pudieron cargar tus gastos.'
    : '';
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
        <View className="mt-4">
          <FilterToggle value={periodo} onChange={setPeriodo} />
        </View>
      </View>

      {errorMessage ? <Text className="text-red-300 mb-4">{errorMessage}</Text> : null}

      <View className="gap-4">
        <View className="flex-row flex-wrap gap-4">
          <MetricCard
            title={`Ingresos del ${periodo === 'mes' ? 'mes' : 'período semanal'}`}
            value={showLoader ? 'Cargando…' : formatCurrency(ingresosSeleccionados?.total)}
            subtitle={isFetching && !showLoader ? 'Actualizando…' : ''}
            loading={showLoader}
          >
            <BreakdownList
              title="Por estado"
              breakdown={ingresosSeleccionados?.breakdown}
              loading={showLoader}
            />
          </MetricCard>

          <MetricCard
            title="Gastos registrados"
            value={showLoader ? 'Cargando…' : formatCurrency(economy?.gastosMes)}
            subtitle="Incluye egresos registrados en mis gastos"
            loading={showLoader}
          />

          <MetricCard
            title="Reservas"
            value={showLoader ? 'Cargando…' : `${totalReservas ?? 0}`}
            subtitle={`Reservas del ${periodo}`}
            loading={showLoader}
          />

          <MetricCard
            title="Balance mensual"
            value={showLoader ? 'Cargando…' : formatCurrency(economy?.balanceMensual)}
            subtitle="Ingresos proyectados - gastos"
            loading={showLoader}
          />
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
                      label: item.label,
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
                    data={[
                      { label: 'Semana', value: economy?.ingresosSemana?.total ?? 0 },
                      { label: 'Mes', value: economy?.ingresosMes?.total ?? 0 },
                      { label: 'Proyección', value: economy?.proyeccion?.mes ?? 0 },
                    ]}
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
