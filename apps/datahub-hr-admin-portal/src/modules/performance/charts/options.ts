import type { EChartsOption, XAXisComponentOption, YAXisComponentOption } from 'echarts';
import { base, grid, html, isRtl, legend, num, palette, tooltip, valueAxisStyle, valueYAxis, type ChartContext, type TooltipParam } from '@/modules/shared/charts/base';
import type { PerformanceSummary } from '@/modules/performance/types/performance';

/*
 * Pure ECharts option builders for Performance (data + context → option), on the shared chart helpers: theme colours
 * for light/dark, Latin digits, explicit RTL mirroring.
 */

function categoryX(ctx: ChartContext, labels: string[]): XAXisComponentOption {
  const c = palette(ctx);
  return { type: 'category', data: labels, inverse: isRtl(ctx), axisLine: { lineStyle: { color: c.axisLine } }, axisTick: { show: false }, axisLabel: { color: c.mutedText, interval: 0, width: 110, overflow: 'truncate' } };
}

const axisTooltip = (ctx: ChartContext, titles: string[], format: (v: number) => string = (v) => num(ctx, v)) =>
  tooltip(ctx, {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: (raw: unknown) => {
      const params = raw as TooltipParam[];
      const rows = params.filter((p) => p.value !== null && p.value !== undefined).map((p) => `<div><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color};margin:0 6px"></span>${html(p.seriesName)}: <b>${format(p.value)}</b></div>`).join('');
      return `<div><b>${html(titles[params[0]?.dataIndex ?? 0] ?? '')}</b></div>${rows}`;
    },
  });

/** Completed reviews per rating value (current cycles). */
export function distributionOption(distribution: PerformanceSummary['distribution'], ctx: ChartContext, label: (value: number) => string, seriesName: string): EChartsOption {
  const c = palette(ctx);
  const colors = [c.red, c.amber, c.blue, c.teal, c.green];
  const titles = distribution.map((d) => label(d.value));
  return {
    ...base(ctx),
    grid: { ...grid, top: 16 },
    tooltip: axisTooltip(ctx, titles),
    xAxis: categoryX(ctx, distribution.map((d) => String(d.value))),
    yAxis: valueYAxis(ctx),
    series: [{ name: seriesName, type: 'bar', barMaxWidth: 40, data: distribution.map((d, i) => ({ value: d.count, itemStyle: { color: colors[i] ?? c.blue } })) }],
  };
}

export interface CompletionLabels {
  completed: string;
  pendingManager: string;
  pendingSelf: string;
}

/** Per current cycle: completed / awaiting the manager / awaiting the self-assessment (stacked, horizontal). */
export function completionOption(rows: PerformanceSummary['completion'], ctx: ChartContext, labels: CompletionLabels): EChartsOption {
  const c = palette(ctx);
  const names = rows.map((r) => r.cycle.name[ctx.language]);
  const series = [
    { name: labels.completed, color: c.green, data: rows.map((r) => r.completed) },
    { name: labels.pendingManager, color: c.amber, data: rows.map((r) => r.pendingManager) },
    { name: labels.pendingSelf, color: c.slate, data: rows.map((r) => r.pendingSelf) },
  ];
  const legendNames = series.map((s) => s.name);
  const xAxis: XAXisComponentOption = { type: 'value', inverse: isRtl(ctx), ...valueAxisStyle(ctx) };
  const yAxis: YAXisComponentOption = { type: 'category', data: names, inverse: true, position: isRtl(ctx) ? 'right' : 'left', axisLine: { lineStyle: { color: c.axisLine } }, axisTick: { show: false }, axisLabel: { color: c.mutedText, width: 130, overflow: 'truncate' } };
  return {
    ...base(ctx),
    color: series.map((s) => s.color),
    legend: { ...legend(ctx, 'top'), data: isRtl(ctx) ? [...legendNames].reverse() : legendNames },
    grid: { ...grid, top: 40 },
    tooltip: axisTooltip(ctx, names),
    xAxis,
    yAxis,
    series: series.map((s) => ({ name: s.name, type: 'bar', stack: 'reviews', barMaxWidth: 26, data: s.data })),
  };
}

/** Average overall rating per top-level department. */
export function departmentOption(rows: PerformanceSummary['byDepartment'], ctx: ChartContext, seriesName: string, max: number): EChartsOption {
  const c = palette(ctx);
  const names = rows.map((r) => r.department.name[ctx.language]);
  return {
    ...base(ctx),
    color: [c.blue],
    grid: { ...grid, top: 16 },
    tooltip: axisTooltip(ctx, names, (v) => num(ctx, v)),
    xAxis: categoryX(ctx, names),
    yAxis: { ...valueYAxis(ctx), min: 0, max },
    series: [{ name: seriesName, type: 'bar', barMaxWidth: 32, data: rows.map((r) => r.average) }],
  };
}

/** Average rating across cycles, oldest first. */
export function trendOption(rows: PerformanceSummary['trend'], ctx: ChartContext, seriesName: string, max: number): EChartsOption {
  const c = palette(ctx);
  const names = rows.map((r) => r.cycle.name[ctx.language]);
  return {
    ...base(ctx),
    color: [c.teal],
    grid: { ...grid, top: 16 },
    tooltip: axisTooltip(ctx, names, (v) => num(ctx, v)),
    xAxis: { ...categoryX(ctx, names), boundaryGap: false } as XAXisComponentOption,
    yAxis: { ...valueYAxis(ctx), min: 0, max },
    series: [{ name: seriesName, type: 'line', smooth: true, symbol: 'circle', symbolSize: 8, connectNulls: true, data: rows.map((r) => r.average) }],
  };
}
