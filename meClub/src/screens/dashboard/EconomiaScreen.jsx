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
import Svg, { Rect, Path, Line, Circle, Text as SvgText } from 'react-native-svg';

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

const weekdayAliases = {
  domingo: 6,
  dom: 6,
  lunes: 0,
  lun: 0,
  martes: 1,
  mar: 1,
  miercoles: 2,
  miércoles: 2,
  mie: 2,
  míe: 2,
  jueves: 3,
  jue: 3,
  viernes: 4,
  vie: 4,
  sabado: 5,
  sábado: 5,
  sab: 5,
  sáb: 5,
};

const WEEKDAY_SHORT_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const toNumberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeWeekdayValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (value === 0 || value === 7) return 6;
    return Math.max(0, Math.min(6, value - 1));
  }
  const key = value.toString().trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(weekdayAliases, key) ? weekdayAliases[key] : null;
};

const parseDateValue = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfWeek = (value) => {
  const base = parseDateValue(value) ?? new Date();
  const normalized = new Date(base);
  normalized.setHours(0, 0, 0, 0);
  const day = normalized.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diff);
  return normalized;
};

const formatDateOnly = (date) => {
  const safeDate = parseDateValue(date);
  return safeDate ? safeDate.toISOString().slice(0, 10) : '';
};

const formatDateRangeLabel = (startDate, endDate) => {
  const start = parseDateValue(startDate);
  const end = parseDateValue(endDate);

  if (!start || !end) return '';

  const formatter = (date) =>
    date.toLocaleDateString('es-AR', {
      month: 'short',
      day: 'numeric',
    });

  return `${formatter(start)} - ${formatter(end)}`;
};

const formatWeekRangeLabel = (weekStart) => {
  const startDate = startOfWeek(weekStart);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  const formatter = (date) =>
    date.toLocaleDateString('es-AR', {
      month: 'short',
      day: 'numeric',
    });

  return `${formatter(startDate)} - ${formatter(endDate)}`;
};

const buildDailyIncome = ({ rawItems = [], fallbackTotal = 0 }) => {
  const items = Array.isArray(rawItems) ? rawItems : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastSevenDays = Array.from({ length: 7 }, (_, idx) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - idx));
    return date;
  });

  const matchByDay = (targetIndex, targetDate) =>
    items.find((item) => {
      const rawDate = item.fecha ?? item.date;
      const parsedDate = parseDateValue(rawDate);
      if (parsedDate && formatDateOnly(parsedDate) === formatDateOnly(targetDate)) return true;

      const normalizedDay = normalizeWeekdayValue(item.dia ?? item.label);
      return normalizedDay === targetIndex;
    });

  const chartItems = lastSevenDays.map((currentDate) => {
    const dayIndex = currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1;
    const match = matchByDay(dayIndex, currentDate) || {};
    const value = toNumberOrZero(
      match.total ?? match.monto ?? match.value ?? match.ingresos ?? match.cantidad
    );

    return {
      label: WEEKDAY_SHORT_LABELS[dayIndex],
      value,
      date: formatDateOnly(currentDate),
    };
  });

  let total = chartItems.reduce((acc, item) => acc + item.value, 0);
  const rangeStart = formatDateOnly(lastSevenDays[0]);
  const rangeEnd = formatDateOnly(lastSevenDays[lastSevenDays.length - 1]);

  if (!items.length && total === 0) {
    const stubBase = fallbackTotal || 7000;
    const average = stubBase / WEEKDAY_SHORT_LABELS.length;
    const multipliers = [0.95, 1.08, 1.02, 1.12, 0.9, 1.18, 0.85];
    const stubbed = chartItems.map((item, index) => ({
      ...item,
      value: Math.max(0, Math.round(average * multipliers[index])),
    }));
    total = stubbed.reduce((acc, item) => acc + item.value, 0);
    return {
      items: stubbed,
      total,
      startDate: rangeStart,
      endDate: rangeEnd,
      isStub: true,
    };
  }

  return {
    items: chartItems,
    total,
    startDate: rangeStart,
    endDate: rangeEnd,
    isStub: false,
  };
};

const buildWeeklyIncome = ({ rawItems = [], fallbackTotal = 0, weeks = 6 }) => {
  const weeksBack = Math.max(1, weeks);
  const chartItems = Array.isArray(rawItems)
    ? rawItems
        .map((item, index) => {
          const startDate = item.startDate || item.fecha_inicio || item.start || item.desde;
          const endDate = item.endDate || item.fecha_fin || item.end || item.hasta;
          const label =
            item.label ||
            (startDate ? formatWeekRangeLabel(startDate) : endDate ? formatWeekRangeLabel(endDate) : `S${index + 1}`);

          const stateBreakdown = item.ingresos || item.estados;
          const hasStateBreakdown =
            stateBreakdown && typeof stateBreakdown === 'object' && !Array.isArray(stateBreakdown);

          const statesValue = hasStateBreakdown
            ? ['pagado', 'senado'].reduce(
                (acc, key) => acc + toNumberOrZero(stateBreakdown?.[key]),
                0
              )
            : null;

          const value =
            statesValue !== null
              ? statesValue
              : toNumberOrZero(item.value ?? item.total ?? item.monto ?? item.ingresos);

          return label
            ? {
                label,
                value,
                startDate: formatDateOnly(startDate),
                endDate: formatDateOnly(endDate),
              }
            : null;
        })
        .filter(Boolean)
    : [];

  let total = chartItems.reduce((acc, item) => acc + item.value, 0);

  if (!chartItems.length) {
    const baseTotal = fallbackTotal || 42000;
    const average = baseTotal / weeksBack;
    const multipliers = [0.9, 1, 1.08, 0.95, 1.15, 1.02];
    const currentWeek = startOfWeek(new Date());

    const stubbed = Array.from({ length: weeksBack }, (_, idx) => {
      const start = new Date(currentWeek);
      start.setDate(currentWeek.getDate() - (weeksBack - idx - 1) * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      return {
        label: formatWeekRangeLabel(start),
        startDate: formatDateOnly(start),
        endDate: formatDateOnly(end),
        value: Math.max(0, Math.round(average * multipliers[idx % multipliers.length])),
      };
    });

    total = stubbed.reduce((acc, item) => acc + item.value, 0);
    return { items: stubbed, total, isStub: true };
  }

  return { items: chartItems, total, isStub: false };
};

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

      const dailyIncome = buildDailyIncome({
        rawItems: economy?.ingresosDiarios,
        fallbackTotal: ingresosSemanalesProyectados || ingresosSemanalesReales,
      });

      const weeklyIncome = buildWeeklyIncome({
        rawItems: economy?.ingresosSemanalesSerie,
        fallbackTotal: ingresosSemanalesProyectados || ingresosSemanalesReales,
      });

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

      const normalizeMonthlyEconomy = () => {
        const monthly = Array.isArray(economy?.economiaMensual) ? economy.economiaMensual : [];
        return monthly.map((item, index) => {
          const ingresosTotal = ['pagado', 'senado', 'pendiente_pago'].reduce(
            (acc, key) => acc + (Number(item?.ingresos?.[key]) || 0),
            0
          );

          return {
            label: item?.label || formatMonthLabel(item?.periodo) || `M${index + 1}`,
            periodo: item?.periodo,
            ingresos: ingresosTotal,
            gastos: Number(item?.gastos) || 0,
            balance: Number.isFinite(Number(item?.balance))
              ? Number(item.balance)
              : ingresosTotal - (Number(item?.gastos) || 0),
          };
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
        ingresosDiarios: dailyIncome.items,
        ingresosDiariosTotal: dailyIncome.total,
        ingresosSemanalesSerie: weeklyIncome.items,
        selectedWeek: { start: dailyIncome.startDate, end: dailyIncome.endDate },
        economiaMensual: normalizeMonthlyEconomy(),
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
  const hasValue = value !== undefined && value !== null && value !== '';
  const accessibleLabel = `${title}${hasValue ? ` ${value}` : ''}${subtitle ? `, ${subtitle}` : ''}`;

  return (
    <Card
      className="flex-1 min-w-[240px]"
      accessibilityLabel={accessibleLabel}
      accessible
    >
      <CardTitle colorClass="text-white/80">{title}</CardTitle>
      <View className="mt-3 gap-2">
        {loading ? (
          <View className="h-9 w-32 rounded-lg bg-white/10" />
        ) : hasValue ? (
          <Text className="text-white text-[32px] font-extrabold mt-1">{value}</Text>
        ) : null}
        {subtitle ? <Text className="text-white/50">{subtitle}</Text> : null}
        {children}
      </View>
    </Card>
  );
}

function BarChart({ data = [], height = 140 }) {
  const [layoutWidth, setLayoutWidth] = React.useState(null);
  const [activeIndex, setActiveIndex] = React.useState(null);

  if (!data.length) return (
    <View className="h-[140px] justify-center items-center">
      <Text className="text-white/40 text-xs">Sin datos</Text>
    </View>
  );

  const maxValue = Math.max(...data.map((d) => d.value || 0), 1);
  const padding = { top: 8, right: 12, bottom: 40, left: 12 };
  const estimatedWidth = Math.max(220, Math.min(540, data.length * 64));
  const effectiveWidth = layoutWidth || estimatedWidth;
  const chartHeight = height - padding.top - padding.bottom;
  const innerWidth = Math.max(1, effectiveWidth - padding.left - padding.right);
  const slot = innerWidth / data.length;
  let barWidth = Math.min(36, Math.max(8, slot * 0.7));
  if (barWidth > slot - 4) {
    barWidth = Math.max(6, slot - 4);
  }
  const gap = Math.max(6, Math.min(16, slot - barWidth));
  const chartInnerWidth = data.length * barWidth + Math.max(0, data.length - 1) * gap;
  const chartWidth = Math.max(effectiveWidth, chartInnerWidth + padding.left + padding.right);

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

  const formatValue = (value) =>
    new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(
      Number.isFinite(Number(value)) ? Number(value) : 0
    );

  const activeItem = activeIndex !== null ? data[activeIndex] : null;
  const activeBarX =
    activeIndex !== null ? padding.left + activeIndex * (barWidth + gap) : null;
  const activeBarHeight =
    activeItem !== null && activeItem !== undefined
      ? Math.max((Number(activeItem?.value) / maxValue) * chartHeight, 4)
      : null;
  const activeCenterX = activeBarX !== null ? activeBarX + barWidth / 2 : null;
  const activeTopY =
    activeBarHeight !== null ? padding.top + (chartHeight - activeBarHeight) : null;
  const tooltipLabel = activeItem?.label || formatBarLabel(activeItem || {});
  const tooltipValue = formatValue(activeItem?.value);
  const tooltipWidth = Math.min(
    180,
    Math.max(96, ((tooltipLabel?.length || 0) + tooltipValue.length) * 4)
  );
  const tooltipX = activeCenterX
    ? Math.min(
        chartWidth - padding.right - tooltipWidth / 2,
        Math.max(padding.left + tooltipWidth / 2, activeCenterX)
      )
    : 0;
  const tooltipY = activeTopY !== null ? Math.max(padding.top + 4, activeTopY - 8) : 0;

  return (
    <View
      className="w-full"
      onLayout={(event) => setLayoutWidth(event?.nativeEvent?.layout?.width || null)}
    >
      <Svg
        height={height}
        width={chartWidth}
        viewBox={`0 0 ${chartWidth} ${height}`}
        accessibilityLabel="Gráfico de barras"
        accessible
      >
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
                onPressIn={() => setActiveIndex(index)}
                onPressOut={() => setActiveIndex(null)}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                accessibilityRole="button"
                accessibilityLabel={`${label || 'Barra'}: ${formatValue(item.value)}`}
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
            </React.Fragment>
          );
        })}

        {activeItem ? (
          <React.Fragment>
            <Rect
              x={tooltipX - tooltipWidth / 2}
              y={tooltipY - 34}
              width={tooltipWidth}
              height={32}
              rx={8}
              fill="rgba(15, 23, 42, 0.92)"
              stroke="#38bdf8"
              strokeWidth={1}
            />
            <SvgText
              x={tooltipX}
              y={tooltipY - 22}
              fill="white"
              fontSize="12"
              fontWeight="bold"
              textAnchor="middle"
            >
              {tooltipLabel}
            </SvgText>
            <SvgText x={tooltipX} y={tooltipY - 10} fill="#bae6fd" fontSize="12" textAnchor="middle">
              {tooltipValue}
            </SvgText>
          </React.Fragment>
        ) : null}
      </Svg>
    </View>
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

function MultiAreaLineChart({ data = [], height = 200 }) {
  if (!data.length) {
    return (
      <View className="h-[200px] justify-center items-center">
        <Text className="text-white/40 text-xs">Sin datos</Text>
      </View>
    );
  }

  const maxValue = Math.max(
    ...data.flatMap((item) => [item.ingresos, item.gastos, item.balance].map((val) => Math.abs(Number(val) || 0))),
    1
  );
  const padding = { top: 16, right: 20, bottom: 36, left: 24 };
  const minInnerWidth = 240;
  const innerWidth = Math.max(minInnerWidth, (data.length - 1) * 64);
  const chartWidth = innerWidth + padding.left + padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const baselineY = padding.top + chartHeight;
  const step = data.length > 1 ? innerWidth / (data.length - 1) : 0;

  const series = [
    { key: 'ingresos', color: '#22d3ee', fill: 'rgba(34,211,238,0.12)' },
    { key: 'gastos', color: '#f43f5e', fill: 'rgba(244,63,94,0.12)' },
    { key: 'balance', color: '#a855f7', fill: 'rgba(168,85,247,0.12)' },
  ];

  const buildPoints = (key) =>
    data.map((item, index) => ({
      x: padding.left + index * step,
      y: padding.top + chartHeight - ((Number(item?.[key]) || 0) / maxValue) * chartHeight,
      label: item.label || '',
      value: Number(item?.[key]) || 0,
    }));

  const buildPath = (points) =>
    points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
      .join(' ');

  return (
    <Svg height={height} width={chartWidth} viewBox={`0 0 ${chartWidth} ${height}`}>
      <Line
        x1={padding.left}
        y1={baselineY}
        x2={padding.left + innerWidth}
        y2={baselineY}
        stroke="#94a3b8"
        strokeWidth={1}
        opacity={0.35}
      />

      {series.map((serie) => {
        const points = buildPoints(serie.key);
        const path = buildPath(points);
        const areaPath = `M${padding.left},${baselineY} ${path.replace('M', 'L')} L${padding.left + innerWidth},${baselineY} Z`;

        return (
          <React.Fragment key={serie.key}>
            <Path d={areaPath} fill={serie.fill} stroke="none" />
            <Path
              d={path}
              fill="none"
              stroke={serie.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((point, index) => (
              <Circle key={`${serie.key}-${index}`} cx={point.x} cy={point.y} r={3.4} fill={serie.color} />
            ))}
          </React.Fragment>
        );
      })}

      {data.map((item, index) => {
        const x = padding.left + index * step;
        return (
          <SvgText
            key={`${item.label || index}-label`}
            x={x}
            y={height - padding.bottom / 2}
            fill="white"
            fontSize="12"
            textAnchor="middle"
          >
            {item.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

function ExpenseModal({ visible, onClose, onSubmit, loading, initialValue }) {
  const [categoria, setCategoria] = useState(initialValue?.categoria || '');
  const [descripcion, setDescripcion] = useState(initialValue?.descripcion || '');
  const [monto, setMonto] = useState(initialValue?.monto?.toString() || '');
  const [icono, setIcono] = useState(initialValue?.icono || initialValue?.icon || '');

  const iconOptions = useMemo(() => {
    const baseOptions = [
      { label: 'Luz', value: '💡' },
      { label: 'Agua', value: '💧' },
      { label: 'Alquiler', value: '🏠' },
      { label: 'Salario', value: '💰' },
      { label: 'Compras', value: '🛒' },
      { label: 'Intereses', value: '📈' },
      { label: 'Internet', value: '🌐' },
      { label: 'Transporte', value: '🚌' },
      { label: 'Comida', value: '🍽️' },
      { label: 'Mantenimiento', value: '🛠️' },
      { label: 'Impuestos', value: '💳' },
    ];

    const currentIcon = initialValue?.icono || initialValue?.icon;
    if (currentIcon && !baseOptions.some((option) => option.value === currentIcon)) {
      return [{ label: 'Actual', value: currentIcon }, ...baseOptions];
    }

    return baseOptions;
  }, [initialValue?.icon, initialValue?.icono]);

  useEffect(() => {
    setCategoria(initialValue?.categoria || '');
    setDescripcion(initialValue?.descripcion || '');
    setMonto(initialValue?.monto?.toString() || '');
    setIcono(initialValue?.icono || initialValue?.icon || '');
  }, [initialValue]);

  const handleSubmit = () => {
    const parsedMonto = Number(monto);
    const normalizedIcono = icono?.trim?.() || '';
    const isValidIcon = iconOptions.some((option) => option.value === normalizedIcono);
    if (!categoria || !normalizedIcono || Number.isNaN(parsedMonto) || !isValidIcon) return;
    onSubmit({ categoria, descripcion, monto: parsedMonto, icono: normalizedIcono });
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
            <View>
              <Text className="text-white/70 mb-2">Icono</Text>
              <View className="flex-row flex-wrap gap-3">
                {iconOptions.map((option) => {
                  const isSelected = option.value === icono;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setIcono(option.value)}
                      className={`w-[82px] items-center rounded-xl border px-3 py-2 ${
                        isSelected ? 'border-emerald-400 bg-emerald-500/20' : 'border-white/10 bg-white/5'
                      }`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`Icono ${option.label}`}
                    >
                      <Text className="text-white text-2xl">{option.value}</Text>
                      <Text className="text-white/70 text-xs mt-1" numberOfLines={1}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
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
          <View className="flex-1 flex-row gap-3 items-start">
            {expense.icono || expense.icon ? (
              <Text className="text-white text-xl w-8 text-center leading-6">
                {expense.icono || expense.icon}
              </Text>
            ) : null}
            <View className="flex-1">
              <Text className="text-white font-semibold">{expense.categoria}</Text>
              {expense.descripcion ? (
                <Text className="text-white/60 text-sm">{expense.descripcion}</Text>
              ) : null}
              <Text className="text-white/70 text-xs mt-1">{expense.fecha ?? 'Sin fecha'}</Text>
            </View>
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
  const chartLoading = showLoader || isFetching;
  const errorMessage = !clubId
    ? 'No encontramos el club asociado a tu perfil.'
    : isError
      ? error?.message || 'No se pudo cargar la economía del club.'
      : '';

  const ingresosMensuales = economy?.ingresosMes;
  const ingresosSemanales = economy?.ingresosSemana;
  const ingresosMensualesHistoricos = economy?.ingresosMensualesHistoricos ?? [];
  const ingresosSemanalesSerie = economy?.ingresosSemanalesSerie ?? [];
  const economiaMensual = economy?.economiaMensual ?? [];
  const gastosMensuales = economy?.gastosMes;
  const gastosSemanales = economy?.gastosSemana;
  const reservasMensuales = economy?.reservas?.mes;
  const reservasSemanales = economy?.reservas?.semana;
  const balanceMensual = economy?.balanceMensual;
  const currentMonthLabel = useMemo(
    () =>
      new Date().toLocaleDateString('es-AR', {
        month: 'long',
      }),
    []
  );
  const balanceStatus = useMemo(() => {
    const parsedBalance = Number(balanceMensual);
    const amount = Number.isFinite(parsedBalance) ? parsedBalance : 0;

    if (amount < 0) {
      return { label: 'riesgoso', colorClass: 'text-rose-300', iconColor: 'bg-rose-400' };
    }

    if (amount >= 150000) {
      return { label: 'saludable', colorClass: 'text-emerald-300', iconColor: 'bg-emerald-400' };
    }

    return { label: 'débil', colorClass: 'text-amber-200', iconColor: 'bg-amber-300' };
  }, [balanceMensual]);
  const ultimoFlujoMensual = economiaMensual[economiaMensual.length - 1];
  const ingresosDiarios = economy?.ingresosDiarios ?? [];
  const ingresosDiariosTotal = economy?.ingresosDiariosTotal ?? 0;
  const selectedWeek = economy?.selectedWeek ?? {};
  const selectedWeekRangeLabel = useMemo(
    () => formatDateRangeLabel(selectedWeek?.start, selectedWeek?.end),
    [selectedWeek?.start, selectedWeek?.end]
  );

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
            value={
              showLoader ? 'Cargando…' : `${formatCurrency(ingresosMensuales?.total)} este mes`
            }
            subtitle={
              showLoader ? '' : `${formatCurrency(ingresosSemanales?.total)} esta semana`
            }
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
          </MetricCard>

          <MetricCard
            title="Gastos registrados"
            value={showLoader ? 'Cargando…' : formatCurrency(gastosMensuales)}
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
                <View className="gap-2" accessibilityLabel="Gastos recientes" accessible>
                  {recentExpenses.map((expense) => {
                    const expenseIcon = expense.icono || expense.icon || '•';
                    return (
                      <View
                        key={expense.id}
                        className="flex-row items-center gap-3 rounded-xl bg-white/5 px-3 py-2"
                      >
                        <Text className="text-white text-xl w-8 text-center">{expenseIcon}</Text>
                        <Text className="text-white/60 text-base flex-1">
                          {expense.descripcion || expense.categoria}: {formatCurrency(expense.monto)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text className="text-white/40 text-sm">Sin gastos recientes</Text>
              )}
            </View>
          </MetricCard>

          <MetricCard
            title="Reservas"
            value={showLoader ? 'Cargando…' : undefined}
            subtitle=""
            loading={showLoader}
          >
            {!showLoader ? (
              <View
                className="gap-3"
                accessibilityLabel={`Reservas del mes ${reservasMensuales ?? 0}, reservas de la semana ${
                  reservasSemanales ?? 0
                }`}
                accessible
              >
                <View className="gap-1">
                  <Text className="text-white text-3xl font-extrabold">{reservasMensuales ?? 0}</Text>
                  <Text className="text-white/60 text-sm uppercase tracking-[0.12em]">Total mensual</Text>
                </View>
                <View className="gap-1">
                  <Text className="text-white text-3xl font-extrabold">{reservasSemanales ?? 0}</Text>
                  <Text className="text-white/60 text-sm uppercase tracking-[0.12em]">Total semanal</Text>
                </View>
              </View>
            ) : null}
          </MetricCard>

          <MetricCard
            title="Balance"
            value={showLoader ? 'Cargando…' : formatCurrency(balanceMensual)}
            loading={showLoader}
          >
            {!showLoader ? (
              <View className="gap-2">
                <Text className="text-white/60">
                  Total proyectado mes de {currentMonthLabel}
                </Text>
                <View className="flex-row items-center gap-2">
                  <View className={`h-2.5 w-2.5 rounded-full ${balanceStatus.iconColor}`} />
                  <Text className={`${balanceStatus.colorClass} font-semibold capitalize`}>
                    {balanceStatus.label}
                  </Text>
                </View>
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
              {chartLoading ? (
                <View className="h-[140px] rounded-2xl bg-white/10" />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <BarChart
                    data={ingresosSemanalesSerie.map((item) => ({
                      ...item,
                      label:
                        item.label ||
                        (item.startDate || item.endDate
                          ? formatWeekRangeLabel(item.startDate || item.endDate)
                          : ''),
                      value: item.value,
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

          <Card className="flex-1 min-w-[320px]" accessibilityRole="summary">
            <View className="flex-row items-center justify-between">
              <CardTitle colorClass="text-sky-200">Ingresos diarios</CardTitle>
              <Text className="text-white font-bold">{formatCurrency(ingresosDiariosTotal)}</Text>
            </View>

            <View className="items-end mt-2">
              <Text className="text-white/70 text-sm">{selectedWeekRangeLabel}</Text>
            </View>

            <View className="mt-4">
              {chartLoading ? (
                <View className="h-[160px] rounded-2xl bg-white/10" />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <BarChart data={ingresosDiarios} height={160} />
                </ScrollView>
              )}
            </View>
          </Card>
        </View>

        <View className="flex-row flex-wrap gap-4">
          <Card className="flex-1 min-w-[320px]" accessibilityRole="summary">
            <View className="flex-row items-center justify-between">
              <CardTitle colorClass="text-white">Flujo mensual</CardTitle>
              {ultimoFlujoMensual && !chartLoading ? (
                <View className="items-end">
                  <Text className="text-white text-lg font-semibold">
                    {formatCurrency(ultimoFlujoMensual.balance)}
                  </Text>
                  <Text className="text-white/60 text-xs">{ultimoFlujoMensual.label}</Text>
                </View>
              ) : null}
            </View>

            <View className="flex-row flex-wrap gap-3 mt-3">
              {[{ label: 'Ingresos', color: 'bg-cyan-400' }, { label: 'Gastos', color: 'bg-rose-400' }, { label: 'Balance', color: 'bg-purple-400' }].map(
                (item) => (
                  <View key={item.label} className="flex-row items-center gap-2">
                    <View className={`h-3 w-3 rounded-full ${item.color}`} />
                    <Text className="text-white/70 text-xs">{item.label}</Text>
                  </View>
                )
              )}
            </View>

            <View className="mt-4">
              {chartLoading ? (
                <View className="h-[200px] rounded-2xl bg-white/10" />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <MultiAreaLineChart data={economiaMensual} />
                </ScrollView>
              )}
            </View>
          </Card>

          <Card className="flex-1 min-w-[320px]">
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
