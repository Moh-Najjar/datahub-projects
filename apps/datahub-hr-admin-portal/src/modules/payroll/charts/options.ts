import type { EChartsOption, XAXisComponentOption, YAXisComponentOption } from 'echarts';
import { base, formatMonth, grid, html, isRtl, legend, monthAxis, num, palette, tooltip, valueAxisStyle, valueYAxis, type ChartContext, type TooltipParam } from '@/modules/shared/charts/base';
import type { Currency, Minor, PayrollSummary } from '@/modules/payroll/types/payroll';
import { minorPerUnit } from '@/modules/payroll/utils/money';
import { compactAmount, formatAmount } from '@/modules/payroll/utils/format';

/*
 * Pure ECharts option builders for Payroll (data + context → option), on the shared chart helpers: theme colours for
 * light/dark, Latin digits, explicit RTL mirroring. Bars and lines are drawn in WHOLE currency units (heights only);
 * every tooltip shows the exact amount from the minor units.
 */

/** Whole units for drawing (integer division, never a float amount). */
const units = (minor: Minor, currency: Currency) => (minor - (minor % minorPerUnit(currency))) / minorPerUnit(currency);
const swatch = (color: string) => `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin:0 6px"></span>`;

function moneyAxis(ctx: ChartContext, currency: Currency): YAXisComponentOption {
  return { ...valueYAxis(ctx), axisLabel: { ...valueAxisStyle(ctx).axisLabel, formatter: (v: number) => compactAmount(v * minorPerUnit(currency), currency, ctx.language) } } as YAXisComponentOption;
}

/** Tooltip rows with exact amounts: `exact[series][index]` holds the minor units. */
function exactTooltip(ctx: ChartContext, currency: Currency, title: (index: number) => string, exact: Minor[][], extra?: (index: number) => string) {
  return tooltip(ctx, {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: (raw: unknown) => {
      const params = raw as Array<TooltipParam & { seriesIndex: number }>;
      const index = params[0]?.dataIndex ?? 0;
      const rows = params.map((p) => `<div>${swatch(p.color)}${html(p.seriesName)}: <b dir="ltr">${currency} ${formatAmount(exact[p.seriesIndex]?.[p.dataIndex] ?? 0, currency, ctx.language)}</b></div>`).join('');
      return `<div><b>${html(title(index))}</b></div>${rows}${extra?.(index) ?? ''}`;
    },
  });
}

export interface CostLabels {
  basic: string;
  allowances: string;
  overtime: string;
  employees: string;
}

/** Monthly payroll cost (approved + paid runs): basic and allowances stacked = gross. */
export function costTrendOption(monthly: PayrollSummary['monthly'], currency: Currency, ctx: ChartContext, labels: CostLabels): EChartsOption {
  const c = palette(ctx);
  const months = monthly.map((m) => m.month);
  const series = [
    { name: labels.basic, color: c.primary, exact: monthly.map((m) => m.basic) },
    { name: labels.allowances, color: c.teal, exact: monthly.map((m) => m.allowances) },
  ];
  const names = series.map((s) => s.name);
  return {
    ...base(ctx),
    color: series.map((s) => s.color),
    legend: { ...legend(ctx, 'top'), data: isRtl(ctx) ? [...names].reverse() : names },
    grid,
    tooltip: exactTooltip(
      ctx,
      currency,
      (i) => formatMonth(months[i]!, ctx.language, 'long', true),
      series.map((s) => s.exact),
      (i) => `<div style="margin-top:4px">${html(labels.employees)}: <b>${num(ctx, monthly[i]!.employees)}</b></div>`,
    ),
    xAxis: monthAxis(ctx, months),
    yAxis: moneyAxis(ctx, currency),
    series: series.map((s) => ({ name: s.name, type: 'bar', stack: 'cost', barMaxWidth: 28, data: s.exact.map((v) => units(v, currency)) })),
  };
}

/** Gross versus net salary per month (approved + paid runs); months without payroll are gaps. */
export function grossNetOption(monthly: PayrollSummary['monthly'], currency: Currency, ctx: ChartContext, labels: { gross: string; net: string }): EChartsOption {
  const c = palette(ctx);
  const months = monthly.map((m) => m.month);
  const series = [
    { name: labels.gross, color: c.primary, exact: monthly.map((m) => m.gross) },
    { name: labels.net, color: c.green, exact: monthly.map((m) => m.net) },
  ];
  const names = series.map((s) => s.name);
  return {
    ...base(ctx),
    color: series.map((s) => s.color),
    legend: { ...legend(ctx, 'top'), data: isRtl(ctx) ? [...names].reverse() : names },
    grid,
    tooltip: exactTooltip(
      ctx,
      currency,
      (i) => formatMonth(months[i]!, ctx.language, 'long', true),
      series.map((s) => s.exact),
    ),
    xAxis: monthAxis(ctx, months, false),
    yAxis: moneyAxis(ctx, currency),
    series: series.map((s) => ({ name: s.name, type: 'line', smooth: true, symbol: 'circle', symbolSize: 7, connectNulls: false, data: monthly.map((m, i) => (m.employees === 0 ? null : units(s.exact[i]!, currency))) })),
  };
}

/** Gross cost of the latest approved/paid period per top-level department (horizontal bars, largest first). */
export function departmentCostOption(rows: PayrollSummary['byDepartment'], currency: Currency, ctx: ChartContext, seriesName: string, employeesLabel: string): EChartsOption {
  const c = palette(ctx);
  const names = rows.map((r) => r.department.name[ctx.language]);
  const xAxis: XAXisComponentOption = { type: 'value', inverse: isRtl(ctx), ...valueAxisStyle(ctx), axisLabel: { ...valueAxisStyle(ctx).axisLabel, formatter: (v: number) => compactAmount(v * minorPerUnit(currency), currency, ctx.language) } };
  const yAxis: YAXisComponentOption = { type: 'category', data: names, inverse: true, position: isRtl(ctx) ? 'right' : 'left', axisLine: { lineStyle: { color: c.axisLine } }, axisTick: { show: false }, axisLabel: { color: c.mutedText, width: 120, overflow: 'truncate' } };
  return {
    ...base(ctx),
    color: [c.primary],
    grid: { ...grid, top: 8 },
    tooltip: exactTooltip(
      ctx,
      currency,
      (i) => names[i] ?? '',
      [rows.map((r) => r.gross)],
      (i) => `<div style="margin-top:4px">${html(employeesLabel)}: <b>${num(ctx, rows[i]!.employees)}</b></div>`,
    ),
    xAxis,
    yAxis,
    series: [{ name: seriesName, type: 'bar', barMaxWidth: 22, data: rows.map((r) => units(r.gross, currency)) }],
  };
}

/** Employees per basic-salary range (compensation in force today). */
export function salaryRangeOption(ranges: PayrollSummary['salaryRanges'], currency: Currency, ctx: ChartContext, seriesName: string): EChartsOption {
  const c = palette(ctx);
  const label = (r: PayrollSummary['salaryRanges'][number]) => (r.max === null ? `${num(ctx, units(r.min, currency))}+` : `${num(ctx, units(r.min, currency))}–${num(ctx, units(r.max, currency))}`);
  const labels = ranges.map(label);
  return {
    ...base(ctx),
    color: [c.teal],
    grid: { ...grid, top: 16 },
    tooltip: tooltip(ctx, {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (raw: unknown) => {
        const p = (raw as TooltipParam[])[0];
        return p ? `<div><b dir="ltr">${currency} ${html(labels[p.dataIndex] ?? '')}</b></div><div>${swatch(p.color)}${html(p.seriesName)}: <b>${num(ctx, p.value)}</b></div>` : '';
      },
    }),
    xAxis: { type: 'category', data: labels, inverse: isRtl(ctx), axisLine: { lineStyle: { color: c.axisLine } }, axisTick: { show: false }, axisLabel: { color: c.mutedText, interval: 0, hideOverlap: true } },
    yAxis: valueYAxis(ctx),
    series: [{ name: seriesName, type: 'bar', barMaxWidth: 36, data: ranges.map((r) => r.employees) }],
  };
}
