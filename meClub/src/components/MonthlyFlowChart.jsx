import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

const LEGEND_ITEMS = [
  { label: 'Ingresos', color: 'bg-cyan-400' },
  { label: 'Gastos', color: 'bg-rose-400' },
  { label: 'Balance', color: 'bg-purple-400' },
];

function MultiAreaLineChart({ data = [], height = 200 }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const [layoutWidth, setLayoutWidth] = useState(null);

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
  const padding = { top: 24, right: 24, bottom: 40, left: 28 };
  const minInnerWidth = 240;
  const innerWidth = Math.max(minInnerWidth, (data.length - 1) * 64);
  const chartWidth = innerWidth + padding.left + padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const baselineY = padding.top + chartHeight;
  const step = data.length > 1 ? innerWidth / (data.length - 1) : 0;

  const series = [
    { key: 'ingresos', label: 'Ingresos', color: '#22d3ee', fill: 'rgba(34,211,238,0.12)' },
    { key: 'gastos', label: 'Gastos', color: '#f43f5e', fill: 'rgba(244,63,94,0.12)' },
    { key: 'balance', label: 'Balance', color: '#a855f7', fill: 'rgba(168,85,247,0.12)' },
  ];

  const buildPoints = (key) =>
    data.map((item, index) => ({
      x: padding.left + index * step,
      y: padding.top + chartHeight - ((Number(item?.[key]) || 0) / maxValue) * chartHeight,
      label: item.label || '',
      value: Number(item?.[key]) || 0,
    }));

  const seriesWithPoints = series.map((serie) => ({
    ...serie,
    points: buildPoints(serie.key),
  }));

  const buildPath = (points) =>
    points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
      .join(' ');

  const tooltipItem = activeIndex !== null ? data[activeIndex] : null;
  const tooltipX = activeIndex !== null ? padding.left + activeIndex * step : 0;
  const tooltipAnchorY =
    activeIndex !== null
      ? Math.min(
          ...seriesWithPoints
            .map((serie) => serie.points[activeIndex]?.y)
            .filter((value) => value !== undefined)
        )
      : 0;
  const tooltipEntries = seriesWithPoints.map((serie) => ({
    ...serie,
    formatted: formatCurrency(tooltipItem?.[serie.key] ?? 0),
  }));
  const tooltipLabel = tooltipItem?.label ?? '';
  const tooltipWidth = Math.min(
    220,
    Math.max(
      140,
      Math.max(tooltipLabel.length * 6, ...tooltipEntries.map((entry) => (entry.formatted.length + entry.label.length + 3) * 4))
    )
  );
  const tooltipHeight = 20 + tooltipEntries.length * 16 + 8;
  const clampedTooltipX = activeIndex !== null
    ? Math.min(
        chartWidth - padding.right - tooltipWidth / 2,
        Math.max(padding.left + tooltipWidth / 2, tooltipX)
      )
    : 0;
  const clampedTooltipY = activeIndex !== null
    ? Math.max(padding.top + 8, tooltipAnchorY - tooltipHeight + 8)
    : 0;

  return (
    <View
      className="relative"
      style={{ width: chartWidth, height }}
      onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}
    >
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

        {seriesWithPoints.map((serie) => {
          const path = buildPath(serie.points);
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
              {serie.points.map((point, index) => (
                <Circle
                  key={`${serie.key}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={3.6}
                  fill={serie.color}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onTouchStart={() => setActiveIndex(index)}
                  onTouchEnd={() => setActiveIndex(null)}
                />
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

      {tooltipItem ? (
        <View
          pointerEvents="none"
          className="absolute z-20 rounded-xl border border-cyan-400 bg-slate-900/95 px-3 py-2"
          style={{
            left: Math.min(
              (layoutWidth ?? chartWidth) - tooltipWidth / 2 - 8,
              Math.max(tooltipWidth / 2 + 8, clampedTooltipX)
            ),
            top: Math.max(8, clampedTooltipY - tooltipHeight / 2),
            transform: [{ translateX: -tooltipWidth / 2 }],
            width: tooltipWidth,
          }}
        >
          <Text className="text-white text-xs font-bold text-center">{tooltipLabel}</Text>
          {tooltipEntries.map((entry) => (
            <Text key={entry.key} className="text-[11px] text-center" style={{ color: entry.color }}>
              {`${entry.label}: ${entry.formatted}`}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function MonthlyFlowChart({ data = [], loading = false, error = '', height = 200 }) {
  const content = useMemo(() => {
    if (loading) {
      return <View style={{ height }} className="rounded-2xl bg-white/10" />;
    }
    if (error) {
      return (
        <View
          style={{ height }}
          className="items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4"
        >
          <Text className="text-white/70 text-sm text-center">{error}</Text>
        </View>
      );
    }
    if (!Array.isArray(data) || data.length === 0) {
      return (
        <View style={{ height }} className="items-center justify-center rounded-2xl bg-white/5">
          <Text className="text-white/40 text-xs">Sin datos</Text>
        </View>
      );
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <MultiAreaLineChart data={data} height={height} />
      </ScrollView>
    );
  }, [data, error, height, loading]);

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-3">
        {LEGEND_ITEMS.map((item) => (
          <View key={item.label} className="flex-row items-center gap-2">
            <View className={`h-3 w-3 rounded-full ${item.color}`} />
            <Text className="text-white/70 text-xs">{item.label}</Text>
          </View>
        ))}
      </View>
      {content}
    </View>
  );
}
