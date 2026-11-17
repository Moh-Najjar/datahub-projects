import type { EChartsOption } from 'echarts';
import type { AttendanceOverview, DepartmentHeadcount, EmployeeGrowth, LeaveOverview, LeaveStatus } from '@/modules/dashboard/types/dashboard';

/*
 * Pure ECharts option builders: API data + context (colours, direction, language, labels) → option.
 * Kept out of the React components so they can be unit-tested and rendered with the real engine in tests.
 *
 * ECharts does not mirror charts for RTL, so each builder does it explicitly: category axes run right-to-left
 * (`inverse`), value axes move to the right, legends and tooltips align right.
 */

import {
  base,
  grid,
  html,
  isRtl,
  legend,
  monthAxis,
  monthTooltip,
  num,
  palette,
  percent,
  tooltip,
  valueAxisStyle,
  valueYAxis,
  type ChartContext,
  type TooltipParam,
} from '@/modules/shared/charts/base';

export { formatMonth, type ChartContext, type ChartMode } from '@/modules/shared/charts/base';

export interface GrowthLabels {
  headcount: string;
  previousYear: string;
}

/** Monthly headcount (last 12 months) with the same months one year earlier, dashed. */
export function employeeGrowthOption(data: EmployeeGrowth, ctx: ChartContext, labels: GrowthLabels): EChartsOption {
  const c = palette(ctx);
  const months = data.months.map((m) => m.month);
  return {
    ...base(ctx),
    color: [c.blue, c.reference],
    // In RTL the first series should sit on the right.
    legend: { ...legend(ctx, 'top'), data: isRtl(ctx) ? [labels.previousYear, labels.headcount] : [labels.headcount, labels.previousYear] },
    grid,
    tooltip: tooltip(ctx, { trigger: 'axis', formatter: monthTooltip(ctx, months) }),
    xAxis: monthAxis(ctx, months, false),
    yAxis: valueYAxis(ctx, true),
    series: [
      {
        name: labels.headcount,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5 },
        areaStyle: { opacity: ctx.mode === 'dark' ? 0.18 : 0.1 },
        data: data.months.map((m) => m.headcount),
      },
      {
        name: labels.previousYear,
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.5, type: 'dashed' },
        data: data.months.map((m) => m.previousYear),
      },
    ],
  };
}

export interface AttendanceLabels {
  present: string;
  late: string;
  absent: string;
  onLeave: string;
}

/** Today's attendance split (present / late / absent / on leave) as a doughnut with values and percentages. */
export function attendanceOption(data: AttendanceOverview, ctx: ChartContext, labels: AttendanceLabels): EChartsOption {
  const c = palette(ctx);
  const total = data.present + data.late + data.absent + data.onLeave;
  const slices = [
    { key: 'present', name: labels.present, value: data.present, color: c.green },
    { key: 'late', name: labels.late, value: data.late, color: c.amber },
    { key: 'absent', name: labels.absent, value: data.absent, color: c.red },
    { key: 'onLeave', name: labels.onLeave, value: data.onLeave, color: c.blue },
  ];
  const byName = new Map(slices.map((s) => [s.name, s]));
  const share = (value: number) => percent(ctx, total ? value / total : 0);
  return {
    ...base(ctx),
    tooltip: tooltip(ctx, {
      trigger: 'item',
      formatter: (raw: unknown) => {
        const p = raw as { name: string; value: number; color: string };
        return `${html(p.name)}: <b>${num(ctx, p.value)}</b> (${share(p.value)})`;
      },
    }),
    legend: {
      ...legend(ctx, 'bottom'),
      orient: 'horizontal',
      left: 'center',
      right: undefined,
      // In RTL the first item should sit on the right.
      data: (isRtl(ctx) ? [...slices].reverse() : slices).map((s) => s.name),
      formatter: (name: string) => {
        const slice = byName.get(name);
        if (!slice) return name;
        // Charts draw text left-to-right (see EChart.tsx): in RTL put the name rightmost so it is read first.
        return isRtl(ctx) ? `${share(slice.value)} · ${num(ctx, slice.value)}  ${name}` : `${name}  ${num(ctx, slice.value)} · ${share(slice.value)}`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['52%', '76%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: c.surface, borderWidth: 2 },
        label: { show: false },
        emphasis: { scale: true, scaleSize: 4 },
        data: slices.map((s) => ({ name: s.name, value: s.value, itemStyle: { color: s.color } })),
      },
    ],
  };
}

/** Headcount per department as horizontal bars, largest on top; bars grow from the right in RTL. */
export function departmentOption(data: DepartmentHeadcount, ctx: ChartContext, seriesName: string): EChartsOption {
  const c = palette(ctx);
  const rtl = isRtl(ctx);
  const departments = [...data.departments].sort((a, b) => b.headcount - a.headcount);
  return {
    ...base(ctx),
    color: [c.teal],
    grid: { ...grid, top: 8 },
    tooltip: tooltip(ctx, {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (raw: unknown) => {
        const p = (raw as TooltipParam[])[0];
        return p ? `${html(departments[p.dataIndex]!.name[ctx.language])}: <b>${num(ctx, p.value)}</b>` : '';
      },
    }),
    xAxis: { type: 'value', position: 'bottom', inverse: rtl, ...valueAxisStyle(ctx) },
    yAxis: {
      type: 'category',
      inverse: true,
      position: rtl ? 'right' : 'left',
      data: departments.map((d) => d.name[ctx.language]),
      axisLine: { lineStyle: { color: c.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: c.mutedText },
    },
    series: [
      {
        name: seriesName,
        type: 'bar',
        barMaxWidth: 18,
        data: departments.map((d) => d.headcount),
        itemStyle: { borderRadius: rtl ? [4, 0, 0, 4] : [0, 4, 4, 0] },
        label: { show: true, position: rtl ? 'left' : 'right', color: c.mutedText, formatter: (p: { value: unknown }) => num(ctx, Number(p.value)) },
      },
    ],
  };
}

export type LeaveLabels = Record<LeaveStatus, string> & { total: string };

/** Leave requests per month, stacked by current status. */
export function leaveOption(data: LeaveOverview, ctx: ChartContext, labels: LeaveLabels): EChartsOption {
  const c = palette(ctx);
  const months = data.months.map((m) => m.month);
  const statuses: Array<{ key: LeaveStatus; color: string }> = [
    { key: 'approved', color: c.green },
    { key: 'pending', color: c.amber },
    { key: 'rejected', color: c.red },
    { key: 'cancelled', color: c.slate },
  ];
  const totalRow = (index: number) => {
    const m = data.months[index]!;
    return `<div style="margin-top:4px">${html(labels.total)}: <b>${num(ctx, m.approved + m.pending + m.rejected + m.cancelled)}</b></div>`;
  };
  return {
    ...base(ctx),
    color: statuses.map((s) => s.color),
    legend: { ...legend(ctx, 'top'), data: (isRtl(ctx) ? [...statuses].reverse() : statuses).map((s) => labels[s.key]) },
    grid,
    tooltip: tooltip(ctx, { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: monthTooltip(ctx, months, totalRow) }),
    xAxis: monthAxis(ctx, months),
    yAxis: valueYAxis(ctx),
    series: statuses.map((s) => ({
      name: labels[s.key],
      type: 'bar' as const,
      stack: 'requests',
      barMaxWidth: 28,
      emphasis: { focus: 'series' as const },
      data: data.months.map((m) => m[s.key]),
    })),
  };
}
