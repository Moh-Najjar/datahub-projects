import type { Localized } from '@datahub/shared-types';
import type { TFunction } from 'i18next';
import { formatNumber } from '@/i18n/format';
import { FORMAT_LOCALE, type Locale } from '@/i18n/languages';
import { formatAmount } from '@/modules/payroll';
import type { ChartSpec, EnumName, ReportNote, ReportValue, ValueKind } from '@/modules/reports/types/reports';

/*
 * Display text for report values, shared by the page and the printed report: Latin digits in both languages, exact
 * money from minor units (JOD), dates in the user's language. `null` is "not available" — never shown as 0.
 */

export type ReportsT = TFunction<'reports'>;

export const DASH = '—';

export function formatDay(date: string, language: Locale): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], { dateStyle: 'medium' }).format(new Date(`${date.slice(0, 10)}T00:00`));
}
export function formatMonthName(month: string, language: Locale, style: 'long' | 'short' = 'long'): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], { month: style, year: 'numeric' }).format(new Date(y, m - 1, 1));
}
export function formatTime(iso: string, language: Locale): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(iso));
}

export const enumLabel = (t: ReportsT, name: EnumName, value: string) => t(`enums.${name}.${value}` as never, { defaultValue: value }) as string;
export const label = (t: ReportsT, key: string) => t(`labels.${key}` as never, { defaultValue: key }) as string;

/** Text of one value (identifiers and amounts are plain text; the caller wraps them LTR). */
export function formatValue(t: ReportsT, language: Locale, kind: ValueKind, value: ReportValue, enumName?: EnumName): string {
  if (value === null || value === undefined) return DASH;
  if (typeof value === 'object') return (value as Localized<string>)[language];
  switch (kind) {
    case 'number':
      return typeof value === 'number' ? formatNumber(value, language) : String(value);
    case 'decimal':
    case 'hours':
      return typeof value === 'number' ? formatNumber(value, language, { maximumFractionDigits: 1 }) : String(value);
    case 'rating':
      return typeof value === 'number' ? formatNumber(value, language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value);
    case 'percent':
      return typeof value === 'number' ? formatNumber(value, language, { style: 'percent', maximumFractionDigits: 1 }) : String(value);
    case 'money':
      return typeof value === 'number' ? formatAmount(value, 'JOD', language) : String(value);
    case 'date':
      return formatDay(String(value), language);
    case 'month':
      return formatMonthName(String(value), language);
    case 'enum':
      return enumName ? enumLabel(t, enumName, String(value)) : String(value);
    default:
      return String(value);
  }
}

/** Values that stay left-to-right inside Arabic text (identifiers, amounts, codes). */
export const isLtrKind = (kind: ValueKind) => kind === 'code' || kind === 'money';
export const isNumericKind = (kind: ValueKind) => kind === 'number' || kind === 'decimal' || kind === 'percent' || kind === 'money' || kind === 'rating' || kind === 'hours';

/** A note with its parameters formatted (dates, months, module names). */
export function formatNote(t: ReportsT, language: Locale, n: ReportNote): string {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(n.params ?? {})) {
    if (typeof v === 'number') params[k] = formatNumber(v, language);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(v)) params[k] = formatDay(v, language);
    else if (/^\d{4}-\d{2}$/.test(v)) params[k] = formatMonthName(v, language);
    else if (k === 'module') params[k] = t(`enums.module.${v}` as never, { defaultValue: v }) as string;
    else params[k] = v;
  }
  return t(`notes.${n.key}` as never, { ...params, defaultValue: n.key }) as string;
}

/** Translated category labels of a chart. */
export function chartCategories(t: ReportsT, language: Locale, spec: ChartSpec): string[] {
  return spec.categories.map((c) => {
    if (spec.categoryKind === 'month' && typeof c === 'string') return formatMonthName(c, language, 'short');
    if (spec.categoryKind === 'number' && typeof c === 'number') return formatNumber(c, language);
    return formatValue(t, language, spec.categoryKind, c, spec.categoryEnum);
  });
}

/** Tooltip and axis text of chart values (money exact with currency, ratios as percentages). */
export function chartValueText(language: Locale, spec: ChartSpec) {
  const exact = (v: number) => {
    if (spec.valueKind === 'money') return `JOD ${formatAmount(v, 'JOD', language)}`;
    if (spec.valueKind === 'percent') return formatNumber(v, language, { style: 'percent', maximumFractionDigits: 1 });
    if (spec.valueKind === 'rating') return formatNumber(v, language, { maximumFractionDigits: 2 });
    return formatNumber(v, language, { maximumFractionDigits: 1 });
  };
  // Axis values are the DRAWN numbers (whole dinars, 0–100 for ratios).
  const axis = (v: number) => (spec.valueKind === 'percent' ? `${formatNumber(v, language)}%` : formatNumber(v, language, { notation: spec.valueKind === 'money' ? 'compact' : 'standard', maximumFractionDigits: 1 }));
  return { exact, axis };
}
