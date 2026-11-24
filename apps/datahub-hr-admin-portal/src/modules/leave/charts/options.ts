import type { EChartsOption, XAXisComponentOption, YAXisComponentOption } from 'echarts';
import { base, grid, html, isRtl, legend, monthAxis, monthTooltip, num, palette, percent, tooltip, valueAxisStyle, valueYAxis, type ChartContext, type TooltipParam } from '@/modules/shared/charts/base';
import type { LeaveStatus, LeaveSummary } from '@/modules/leave/types/leave';

/*
 * Pure ECharts option builders for Leave (data + context → option), on the shared chart helpers: theme colours for
 * light/dark, Latin digits, explicit RTL mirroring (ECharts never mirrors itself).
 */

export type DecidedStatus = Exclude<LeaveStatus, 'draft'>;
export type StatusLabels = Record<DecidedStatus, string>;
const CHART_STATUSES: readonly DecidedStatus[] = ['approved', 'pending', 'rejected', 'cancelled'];

/** Chart colour of each request status (same hue family as the status chips). */
export function statusColor(ctx: ChartContext, status: DecidedStatus): string {
  const c = palette(ctx);
  return { approved: c.green, pending: c.amber, rejected: c.red, cancelled: c.slate }[status];
}

const categoryColors = (ctx: ChartContext) => {
  const c = palette(ctx);
  return [c.primary, c.teal, c.blue, c.green, c.amber, c.red, c.slate, c.reference];
};

function doughnut(ctx: ChartContext, data: Array<{ name: string; value: number; itemStyle?: { color: string } }>, unit: (v: number) => string): EChartsOption {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const names = data.map((d) => d.name);
  return {
    ...base(ctx),
    color: categoryColors(ctx),
    tooltip: tooltip(ctx, {
      trigger: 'item',
      formatter: (raw: unknown) => {
        const p = raw as { name: string; value: number };
        return `${html(p.name)}: <b>${html(unit(p.value))}</b> (${percent(ctx, total ? p.value / total : 0)})`;
      },
    }),
    legend: { ...legend(ctx, 'bottom'), type: 'scroll', data: isRtl(ctx) ? [...names].reverse() : names },
    series: [{ type: 'pie', radius: ['48%', '72%'], center: ['50%', '44%'], avoidLabelOverlap: true, label: { show: false }, itemStyle: { borderColor: palette(ctx).surface, borderWidth: 2 }, data }],
  };
}

/** Requests of the year by status (doughnut). */
export function statusOption(byStatus: LeaveSummary['byStatus'], ctx: ChartContext, labels: StatusLabels): EChartsOption {
  const data = CHART_STATUSES.filter((s) => byStatus[s] > 0).map((s) => ({ name: labels[s], value: byStatus[s], itemStyle: { color: statusColor(ctx, s) } }));
  return doughnut(ctx, data, (v) => num(ctx, v));
}

/** Requests per month (by start date), stacked by status. */
export function monthlyOption(monthly: LeaveSummary['monthly'], ctx: ChartContext, labels: StatusLabels): EChartsOption {
  const months = monthly.map((m) => m.month);
  const statuses = CHART_STATUSES.filter((s) => monthly.some((m) => m[s] > 0));
  const names = statuses.map((s) => labels[s]);
  return {
    ...base(ctx),
    color: statuses.map((s) => statusColor(ctx, s)),
    legend: { ...legend(ctx, 'top'), data: isRtl(ctx) ? [...names].reverse() : names },
    grid: { ...grid, top: 44 },
    tooltip: tooltip(ctx, { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: monthTooltip(ctx, months) }),
    xAxis: monthAxis(ctx, months),
    yAxis: valueYAxis(ctx),
    series: statuses.map((s) => ({ name: labels[s], type: 'bar', stack: 'requests', barMaxWidth: 28, data: monthly.map((m) => m[s]) })),
  };
}

/** Approved days by leave type (doughnut). */
export function typeOption(byType: LeaveSummary['byType'], ctx: ChartContext, daysLabel: (days: number) => string): EChartsOption {
  return doughnut(
    ctx,
    byType.map((t) => ({ name: t.leaveType.name[ctx.language], value: t.days })),
    daysLabel,
  );
}

/** Approved days by (top-level) department, horizontal bars, largest first. */
export function departmentOption(byDepartment: LeaveSummary['byDepartment'], ctx: ChartContext, seriesName: string): EChartsOption {
  const c = palette(ctx);
  const names = byDepartment.map((d) => d.department.name[ctx.language]);
  const xAxis: XAXisComponentOption = { type: 'value', inverse: isRtl(ctx), ...valueAxisStyle(ctx) };
  const yAxis: YAXisComponentOption = {
    type: 'category',
    data: names,
    inverse: true,
    position: isRtl(ctx) ? 'right' : 'left',
    axisLine: { lineStyle: { color: c.axisLine } },
    axisTick: { show: false },
    axisLabel: { color: c.mutedText },
  };
  return {
    ...base(ctx),
    color: [c.primary],
    grid: { ...grid, top: 16 },
    tooltip: tooltip(ctx, {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (raw: unknown) => {
        const p = (raw as TooltipParam[])[0];
        return p ? `<div><b>${html(names[p.dataIndex] ?? '')}</b></div><div>${html(seriesName)}: <b>${num(ctx, p.value)}</b></div>` : '';
      },
    }),
    xAxis,
    yAxis,
    series: [{ name: seriesName, type: 'bar', barMaxWidth: 22, data: byDepartment.map((d) => d.days) }],
  };
}
