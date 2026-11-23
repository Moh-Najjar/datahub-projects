import type { EChartsOption, XAXisComponentOption, YAXisComponentOption } from 'echarts';
import { base, grid, html, isRtl, legend, palette, tooltip, valueAxisStyle, type ChartContext } from '@/modules/shared/charts/base';
import type { ChartSpec } from '@/modules/reports/types/reports';

/*
 * One pure option builder for every report chart (spec + context → option), on the shared chart helpers: theme colours
 * for light/dark, Latin digits, explicit RTL mirroring (ECharts never mirrors itself). Money is drawn in whole units
 * (bar heights only) — tooltips always show the exact amount; percentages are ratios drawn as 0–100. `null` values are
 * gaps (no data), never zero.
 */

export interface ChartLabels {
  /** Series name (`reports:labels.<key>`). */
  series: (key: string) => string;
  /** Category label (month, enum, localized name…), already translated. */
  categories: string[];
  /** Exact value text for tooltips (money with currency, percent, rating…). */
  value: (value: number) => string;
  /** Short axis label. */
  axis: (value: number) => string;
}

const MONEY_UNIT = 1000; // JOD minor units per dinar (reports never mix currencies)

/** The number drawn for a value (whole dinars for money, 0–100 for ratios). */
export function drawn(spec: ChartSpec, value: number | null): number | null {
  if (value === null) return null;
  if (spec.valueKind === 'money') return Math.trunc(value / MONEY_UNIT);
  if (spec.valueKind === 'percent') return Math.round(value * 1000) / 10;
  return Math.round(value * 100) / 100;
}

const swatch = (color: string) => `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin:0 6px"></span>`;

export function reportChartOption(spec: ChartSpec, ctx: ChartContext, labels: ChartLabels): EChartsOption {
  const c = palette(ctx);
  const colors = [c.blue, c.teal, c.amber, c.purple, c.green, c.red, c.slate];
  const names = spec.series.map((s) => labels.series(s.key));
  const exact = spec.series.map((s) => s.values);
  const rows = (index: number, params: Array<{ seriesIndex: number; color: string }>) =>
    params
      .map((p) => {
        const v = exact[p.seriesIndex]?.[index] ?? null;
        return `<div>${swatch(p.color)}${html(names[p.seriesIndex] ?? '')}: <b dir="ltr">${v === null ? '—' : html(labels.value(v))}</b></div>`;
      })
      .join('');

  if (spec.type === 'pie') {
    const series = spec.series[0]!;
    return {
      ...base(ctx),
      color: colors,
      legend: { ...legend(ctx, 'bottom'), type: 'scroll', data: isRtl(ctx) ? [...labels.categories].reverse() : labels.categories },
      tooltip: tooltip(ctx, {
        trigger: 'item',
        formatter: (raw: unknown) => {
          const p = raw as { dataIndex: number; color: string; percent: number };
          const v = series.values[p.dataIndex] ?? null;
          return `<div>${swatch(p.color)}${html(labels.categories[p.dataIndex] ?? '')}: <b dir="ltr">${v === null ? '—' : html(labels.value(v))}</b> (${p.percent}%)</div>`;
        },
      }),
      series: [
        {
          name: labels.series(series.key),
          type: 'pie',
          radius: ['45%', '72%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: true,
          label: { show: false },
          itemStyle: { borderColor: c.surface, borderWidth: 2 },
          data: labels.categories.map((name, i) => ({ name, value: drawn(spec, series.values[i] ?? null) ?? 0 })),
        },
      ],
    };
  }

  const valueAxis = { type: 'value' as const, ...valueAxisStyle(ctx), axisLabel: { ...valueAxisStyle(ctx).axisLabel, formatter: (v: number) => labels.axis(v) } };
  const categoryAxis = { type: 'category' as const, data: labels.categories, axisLine: { lineStyle: { color: c.axisLine } }, axisTick: { show: false } };
  const axisTooltip = tooltip(ctx, {
    trigger: 'axis',
    axisPointer: { type: spec.type === 'line' ? 'line' : 'shadow' },
    formatter: (raw: unknown) => {
      const params = raw as Array<{ seriesIndex: number; dataIndex: number; color: string }>;
      const index = params[0]?.dataIndex ?? 0;
      return `<div><b>${html(labels.categories[index] ?? '')}</b></div>${rows(index, params)}`;
    },
  });
  const showLegend = spec.series.length > 1;
  const legendOption = showLegend ? { ...legend(ctx, 'top'), data: isRtl(ctx) ? [...names].reverse() : names } : undefined;

  if (spec.type === 'hbar') {
    const xAxis: XAXisComponentOption = { ...valueAxis, inverse: isRtl(ctx) };
    const yAxis: YAXisComponentOption = { ...categoryAxis, inverse: true, position: isRtl(ctx) ? 'right' : 'left', axisLabel: { color: c.mutedText, width: 130, overflow: 'truncate' } };
    return {
      ...base(ctx),
      color: colors,
      legend: legendOption,
      grid: { ...grid, top: showLegend ? 36 : 8 },
      tooltip: axisTooltip,
      xAxis,
      yAxis,
      series: spec.series.map((s, i) => ({ name: names[i], type: 'bar', barMaxWidth: 20, data: s.values.map((v) => drawn(spec, v)) })),
    };
  }

  const xAxis: XAXisComponentOption = { ...categoryAxis, inverse: isRtl(ctx), boundaryGap: spec.type !== 'line', axisLabel: { color: c.mutedText, hideOverlap: true } };
  const yAxis: YAXisComponentOption = { ...valueAxis, position: isRtl(ctx) ? 'right' : 'left' };
  return {
    ...base(ctx),
    color: colors,
    legend: legendOption,
    grid: { ...grid, top: showLegend ? 44 : 16 },
    tooltip: axisTooltip,
    xAxis,
    yAxis,
    series: spec.series.map((s, i) =>
      spec.type === 'line'
        ? { name: names[i], type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, connectNulls: false, data: s.values.map((v) => drawn(spec, v)) }
        : { name: names[i], type: 'bar', stack: spec.type === 'stacked' ? 'total' : undefined, barMaxWidth: 32, data: s.values.map((v) => drawn(spec, v)) },
    ),
  };
}
