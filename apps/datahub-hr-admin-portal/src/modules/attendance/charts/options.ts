import type { EChartsOption, XAXisComponentOption, YAXisComponentOption } from 'echarts';
import { FORMAT_LOCALE } from '@/i18n/languages';
import { base, grid, html, isRtl, legend, num, palette, percent, tooltip, valueAxisStyle, valueYAxis, type ChartContext, type TooltipParam } from '@/modules/shared/charts/base';
import { formatMonth } from '@/modules/shared/charts/base';
import type { AttendanceStatus, AttendanceSummary, StatusCounts } from '@/modules/attendance/types/attendance';
import { toMs } from '@/modules/attendance/utils/time';

/*
 * Pure ECharts option builders for Attendance (data + context → option), on the shared chart helpers: theme
 * colours for light/dark, Latin digits, and explicit RTL mirroring (ECharts never mirrors itself).
 */

export type StatusLabels = Record<AttendanceStatus, string>;

/** Chart colour of each status (the same hue family as the status chips). */
export function statusColor(ctx: ChartContext, status: AttendanceStatus): string {
  const c = palette(ctx);
  return { present: c.green, late: c.amber, absent: c.red, 'on-leave': c.blue, 'half-day': c.purple, incomplete: c.slate, scheduled: c.reference }[status];
}

/** Statuses drawn in the trend and distribution charts, in legend order. */
const CHART_STATUSES: readonly AttendanceStatus[] = ['present', 'late', 'half-day', 'incomplete', 'absent', 'on-leave', 'scheduled'];

const dayLabel = (date: string, ctx: ChartContext, long = false) =>
  new Intl.DateTimeFormat(FORMAT_LOCALE[ctx.language], long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric' }).format(new Date(toMs(date)));

function categoryAxis(ctx: ChartContext, keys: string[], labels: string[]): XAXisComponentOption {
  const c = palette(ctx);
  return {
    type: 'category',
    data: keys,
    inverse: isRtl(ctx),
    axisLine: { lineStyle: { color: c.axisLine } },
    axisTick: { show: false },
    axisLabel: { color: c.mutedText, formatter: (_: string, index: number) => labels[index] ?? '' },
  };
}

/** Rows "● Label: value" for axis tooltips. */
const rows = (ctx: ChartContext, params: TooltipParam[], format: (v: number) => string = (v) => num(ctx, v)) =>
  params
    .filter((p) => p.value !== null && p.value !== undefined)
    .map((p) => `<div><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color};margin:0 6px"></span>${html(p.seriesName)}: <b>${format(p.value)}</b></div>`)
    .join('');

/** Last 7 days: records per status, stacked. */
export function trendOption(trend: AttendanceSummary['trend'], ctx: ChartContext, labels: StatusLabels): EChartsOption {
  const days = trend.map((d) => d.date);
  const statuses = CHART_STATUSES.filter((s) => trend.some((d) => d[s] > 0));
  const names = statuses.map((s) => labels[s]);
  return {
    ...base(ctx),
    color: statuses.map((s) => statusColor(ctx, s)),
    legend: { ...legend(ctx, 'top'), data: isRtl(ctx) ? [...names].reverse() : names },
    grid: { ...grid, top: 64 },
    tooltip: tooltip(ctx, {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (raw: unknown) => {
        const params = raw as TooltipParam[];
        return `<div><b>${html(dayLabel(days[params[0]?.dataIndex ?? 0]!, ctx, true))}</b></div>${rows(ctx, params)}`;
      },
    }),
    xAxis: categoryAxis(ctx, days, days.map((d) => dayLabel(d, ctx))),
    yAxis: valueYAxis(ctx),
    series: statuses.map((s) => ({ name: labels[s], type: 'bar', stack: 'records', barMaxWidth: 36, data: trend.map((d) => d[s]) })),
  };
}

/** Today's records by status (doughnut). */
export function distributionOption(today: StatusCounts, ctx: ChartContext, labels: StatusLabels): EChartsOption {
  const data = CHART_STATUSES.filter((s) => today[s] > 0).map((s) => ({ name: labels[s], value: today[s], itemStyle: { color: statusColor(ctx, s) } }));
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const names = data.map((d) => d.name);
  return {
    ...base(ctx),
    tooltip: tooltip(ctx, {
      trigger: 'item',
      formatter: (raw: unknown) => {
        const p = raw as { name: string; value: number; color: string };
        return `${html(p.name)}: <b>${num(ctx, p.value)}</b> (${percent(ctx, total ? p.value / total : 0)})`;
      },
    }),
    legend: { ...legend(ctx, 'bottom'), data: isRtl(ctx) ? [...names].reverse() : names },
    series: [
      {
        type: 'pie',
        radius: ['48%', '72%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        label: { show: false },
        itemStyle: { borderColor: palette(ctx).surface, borderWidth: 2 },
        data,
      },
    ],
  };
}

export interface DepartmentLabels {
  onTime: string;
  late: string;
  absent: string;
  onLeave: string;
}

/** Today per (top-level) department: on time / late / absent / on leave, stacked horizontally. */
export function departmentOption(rowsData: AttendanceSummary['byDepartment'], ctx: ChartContext, labels: DepartmentLabels): EChartsOption {
  const c = palette(ctx);
  const sorted = [...rowsData].sort((a, b) => b.scheduled - a.scheduled);
  const names = sorted.map((d) => d.department.name[ctx.language]);
  const series = [
    { name: labels.onTime, color: c.green, data: sorted.map((d) => d.present - d.late) },
    { name: labels.late, color: c.amber, data: sorted.map((d) => d.late) },
    { name: labels.absent, color: c.red, data: sorted.map((d) => d.absent) },
    { name: labels.onLeave, color: c.blue, data: sorted.map((d) => d.onLeave) },
  ];
  const legendNames = series.map((s) => s.name);
  const xAxis: XAXisComponentOption = { type: 'value', inverse: isRtl(ctx), ...valueAxisStyle(ctx) };
  const yAxis: YAXisComponentOption = {
    type: 'category',
    data: names,
    inverse: true, // largest first, at the top
    position: isRtl(ctx) ? 'right' : 'left',
    axisLine: { lineStyle: { color: c.axisLine } },
    axisTick: { show: false },
    axisLabel: { color: c.mutedText },
  };
  return {
    ...base(ctx),
    color: series.map((s) => s.color),
    legend: { ...legend(ctx, 'top'), data: isRtl(ctx) ? [...legendNames].reverse() : legendNames },
    grid: { ...grid, top: 40 },
    tooltip: tooltip(ctx, {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (raw: unknown) => {
        const params = raw as TooltipParam[];
        return `<div><b>${html(names[params[0]?.dataIndex ?? 0] ?? '')}</b></div>${rows(ctx, params)}`;
      },
    }),
    xAxis,
    yAxis,
    series: series.map((s) => ({ name: s.name, type: 'bar', stack: 'today', barMaxWidth: 22, data: s.data })),
  };
}

export interface MonthlyLabels {
  rate: string;
  hours: string;
}

/** Per month: attendance rate (line, %) and average worked hours (bars, second axis). */
export function monthlyOption(monthly: AttendanceSummary['monthly'], ctx: ChartContext, labels: MonthlyLabels): EChartsOption {
  const c = palette(ctx);
  const months = monthly.map((m) => m.month);
  const rate = monthly.map((m) => (m.rate === null ? null : Math.round(m.rate * 1000) / 10));
  const hours = monthly.map((m) => (m.averageMinutes === null ? null : Math.round(m.averageMinutes / 6) / 10));
  const legendNames = [labels.rate, labels.hours];
  const rtl = isRtl(ctx);
  return {
    ...base(ctx),
    color: [c.blue, c.teal],
    legend: { ...legend(ctx, 'top'), data: rtl ? [...legendNames].reverse() : legendNames },
    grid: { ...grid, top: 44 },
    tooltip: tooltip(ctx, {
      trigger: 'axis',
      formatter: (raw: unknown) => {
        const params = raw as TooltipParam[];
        const index = params[0]?.dataIndex ?? 0;
        const body = params
          .map((p) => {
            const value = p.seriesName === labels.rate ? `${num(ctx, p.value)}%` : num(ctx, p.value);
            return `<div><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color};margin:0 6px"></span>${html(p.seriesName)}: <b>${value}</b></div>`;
          })
          .join('');
        return `<div><b>${html(formatMonth(months[index]!, ctx.language, 'long', true))}</b></div>${body}`;
      },
    }),
    xAxis: categoryAxis(ctx, months, months.map((m) => formatMonth(m, ctx.language))),
    yAxis: [
      { type: 'value', min: 0, max: 100, position: rtl ? 'right' : 'left', ...valueAxisStyle(ctx), axisLabel: { color: c.mutedText, formatter: (v: number) => `${num(ctx, v)}%` } },
      { type: 'value', min: 0, position: rtl ? 'left' : 'right', splitLine: { show: false }, axisLabel: { color: c.mutedText, formatter: (v: number) => num(ctx, v) } },
    ],
    series: [
      { name: labels.hours, type: 'bar', yAxisIndex: 1, barMaxWidth: 32, data: hours },
      { name: labels.rate, type: 'line', yAxisIndex: 0, smooth: true, symbol: 'circle', symbolSize: 7, data: rate },
    ],
  };
}
