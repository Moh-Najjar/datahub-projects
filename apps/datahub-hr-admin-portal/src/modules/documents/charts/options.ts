import type { EChartsOption, XAXisComponentOption, YAXisComponentOption } from 'echarts';
import { base, grid, html, isRtl, legend, num, palette, tooltip, valueAxisStyle, valueYAxis, type ChartContext, type TooltipParam } from '@/modules/shared/charts/base';
import type { DocumentsOverview, DocumentStatus } from '@/modules/documents/types/documents';

/*
 * Pure ECharts option builders for Documents (data + context → option), on the shared chart helpers: theme colours for
 * light/dark, Latin digits, explicit RTL mirroring.
 */

const swatch = (color: string) => `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin:0 6px"></span>`;
const axisTooltip = (ctx: ChartContext, titles: string[]) =>
  tooltip(ctx, {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: (raw: unknown) => {
      const p = (raw as TooltipParam[])[0];
      return p ? `<div><b>${html(titles[p.dataIndex] ?? '')}</b></div><div>${swatch(p.color)}${html(p.seriesName)}: <b>${num(ctx, p.value)}</b></div>` : '';
    },
  });

/** Horizontal bars, largest first (categories, departments). */
function horizontalBars(ctx: ChartContext, names: string[], values: number[], seriesName: string, color: string): EChartsOption {
  const c = palette(ctx);
  const xAxis: XAXisComponentOption = { type: 'value', inverse: isRtl(ctx), minInterval: 1, ...valueAxisStyle(ctx) };
  const yAxis: YAXisComponentOption = { type: 'category', data: names, inverse: true, position: isRtl(ctx) ? 'right' : 'left', axisLine: { lineStyle: { color: c.axisLine } }, axisTick: { show: false }, axisLabel: { color: c.mutedText, width: 140, overflow: 'truncate' } };
  return { ...base(ctx), color: [color], grid: { ...grid, top: 8 }, tooltip: axisTooltip(ctx, names), xAxis, yAxis, series: [{ name: seriesName, type: 'bar', barMaxWidth: 18, data: values }] };
}

/** Current documents per category: the 10 largest, the rest summed as "other". */
export function categoryOption(rows: DocumentsOverview['byCategory'], ctx: ChartContext, seriesName: string, otherLabel: string): EChartsOption {
  const top = rows.slice(0, 10);
  const rest = rows.slice(10).reduce((sum, r) => sum + r.count, 0);
  const names = [...top.map((r) => r.category.name[ctx.language]), ...(rest ? [otherLabel] : [])];
  return horizontalBars(ctx, names, [...top.map((r) => r.count), ...(rest ? [rest] : [])], seriesName, palette(ctx).primary);
}

export function departmentOption(rows: DocumentsOverview['byDepartment'], ctx: ChartContext, seriesName: string): EChartsOption {
  return horizontalBars(
    ctx,
    rows.map((r) => r.department.name[ctx.language]),
    rows.map((r) => r.count),
    seriesName,
    palette(ctx).teal,
  );
}

/** Current documents expiring per month over the next 12 months. */
export function expiryOption(months: DocumentsOverview['expiry']['months'], ctx: ChartContext, seriesName: string, monthLabel: (m: string) => string): EChartsOption {
  const c = palette(ctx);
  const labels = months.map((m) => monthLabel(m.month));
  return {
    ...base(ctx),
    color: [c.amber],
    grid: { ...grid, top: 16 },
    tooltip: axisTooltip(ctx, labels),
    xAxis: { type: 'category', data: labels, inverse: isRtl(ctx), axisLine: { lineStyle: { color: c.axisLine } }, axisTick: { show: false }, axisLabel: { color: c.mutedText, hideOverlap: true } },
    yAxis: { ...valueYAxis(ctx), minInterval: 1 } as YAXisComponentOption,
    series: [{ name: seriesName, type: 'bar', barMaxWidth: 28, data: months.map((m) => m.count) }],
  };
}

/** Documents by overall status (donut). Zero slices are left out. */
export function statusOption(rows: DocumentsOverview['byStatus'], ctx: ChartContext, label: (s: DocumentStatus) => string): EChartsOption {
  const c = palette(ctx);
  const colors: Record<DocumentStatus, string> = { verified: c.green, 'pending-review': c.primary, rejected: c.red, expired: c.amber, archived: c.slate, superseded: c.blue };
  const data = rows.filter((r) => r.count > 0).map((r) => ({ name: label(r.status), value: r.count, itemStyle: { color: colors[r.status] } }));
  return {
    ...base(ctx),
    legend: { ...legend(ctx, 'bottom'), type: 'scroll' },
    tooltip: tooltip(ctx, { trigger: 'item', formatter: (raw: unknown) => {
      const p = raw as { name: string; value: number; percent: number; color: string };
      return `${swatch(p.color)}${html(p.name)}: <b>${num(ctx, p.value)}</b> (${num(ctx, p.percent)}%)`;
    } }),
    series: [{ type: 'pie', radius: ['45%', '72%'], center: ['50%', '45%'], avoidLabelOverlap: true, label: { show: false }, data }],
  };
}
