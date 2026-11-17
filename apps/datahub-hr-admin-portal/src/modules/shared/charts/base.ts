import type { EChartsOption, LegendComponentOption, TooltipComponentOption, XAXisComponentOption, YAXisComponentOption } from 'echarts';
import { chartColors, fontFamily } from '@/core/theme/tokens';
import { formatNumber } from '@/i18n/format';
import { FORMAT_LOCALE, type Direction, type Locale } from '@/i18n/languages';

/*
 * Building blocks for ECharts options shared by every chart (dashboard, attendance): theme colours, fonts,
 * Latin digits, and explicit RTL mirroring — ECharts never mirrors itself, so category axes run right-to-left
 * (`inverse`), value axes move to the right, legends and tooltips align right. Month keys are `YYYY-MM`.
 */

export type ChartMode = 'light' | 'dark';

export interface ChartContext {
  mode: ChartMode;
  direction: Direction;
  language: Locale;
}

export const palette = (ctx: ChartContext) => chartColors[ctx.mode];
export const isRtl = (ctx: ChartContext) => ctx.direction === 'rtl';
export const num = (ctx: ChartContext, value: number) => formatNumber(value, ctx.language);
export const percent = (ctx: ChartContext, ratio: number) => formatNumber(ratio, ctx.language, { style: 'percent', maximumFractionDigits: 1 });

/** Escape text inserted into tooltip HTML (labels are ours, names come from API data). */
export const html = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function formatMonth(key: string, language: Locale, month: 'short' | 'long' = 'short', withYear = false): string {
  const [year, monthIndex] = key.split('-').map(Number) as [number, number];
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], { month, ...(withYear ? { year: 'numeric' } : {}) }).format(new Date(year, monthIndex - 1, 1));
}

/** Styling shared by every chart: font, text colour and animation. */
export function base(ctx: ChartContext): EChartsOption {
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: isRtl(ctx) ? fontFamily.arabic : fontFamily.latin, color: palette(ctx).text },
    animationDuration: 400,
  };
}

/** Tooltip look shared by every chart, with RTL text in Arabic. */
export function tooltip(ctx: ChartContext, extra: TooltipComponentOption): TooltipComponentOption {
  const c = palette(ctx);
  return {
    backgroundColor: c.tooltipBackground,
    borderColor: c.tooltipBorder,
    textStyle: { color: c.text, fontFamily: isRtl(ctx) ? fontFamily.arabic : fontFamily.latin },
    extraCssText: `direction: ${ctx.direction}; text-align: ${isRtl(ctx) ? 'right' : 'left'}; box-shadow: none;`,
    ...extra,
  };
}

export function legend(ctx: ChartContext, position: 'top' | 'bottom'): LegendComponentOption {
  return {
    [position]: 0,
    ...(isRtl(ctx) ? { right: 0 } : { left: 0 }),
    align: isRtl(ctx) ? 'right' : 'left',
    icon: 'roundRect',
    itemWidth: 12,
    itemHeight: 8,
    textStyle: { color: palette(ctx).mutedText },
  };
}

/** Month (category) x-axis, running right-to-left in RTL. */
export function monthAxis(ctx: ChartContext, months: string[], boundaryGap = true): XAXisComponentOption {
  const c = palette(ctx);
  const labels = months.map((m) => formatMonth(m, ctx.language));
  return {
    type: 'category',
    data: months,
    boundaryGap,
    inverse: isRtl(ctx),
    axisLine: { lineStyle: { color: c.axisLine } },
    axisTick: { show: false },
    axisLabel: { color: c.mutedText, formatter: (_: string, index: number) => labels[index] ?? '' },
  };
}

/** Styling shared by value axes (gridlines, Latin-digit labels); the axis itself is declared per chart. */
export function valueAxisStyle(ctx: ChartContext) {
  const c = palette(ctx);
  return {
    splitLine: { lineStyle: { color: c.splitLine } },
    axisLabel: { color: c.mutedText, formatter: (v: number) => num(ctx, v) },
  };
}

/** Vertical value axis, on the right in RTL. */
export function valueYAxis(ctx: ChartContext, scale = false): YAXisComponentOption {
  return { type: 'value', position: isRtl(ctx) ? 'right' : 'left', scale, ...valueAxisStyle(ctx) };
}

export const grid = { top: 44, bottom: 8, left: 8, right: 8, containLabel: true } as const;

export interface TooltipParam {
  seriesName: string;
  value: number;
  color: string;
  dataIndex: number;
}

/** Axis tooltip: full month + one row per series. */
export function monthTooltip(ctx: ChartContext, months: string[], extraRows?: (index: number) => string): (params: unknown) => string {
  return (raw) => {
    const params = raw as TooltipParam[];
    const index = params[0]?.dataIndex ?? 0;
    const rows = params.map((p) => `<div><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color};margin:0 6px"></span>${html(p.seriesName)}: <b>${num(ctx, p.value)}</b></div>`);
    return `<div><b>${html(formatMonth(months[index]!, ctx.language, 'long', true))}</b></div>${rows.join('')}${extraRows?.(index) ?? ''}`;
  };
}

