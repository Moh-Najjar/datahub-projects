import type { Localized } from '@datahub/shared-types';
import i18n from '@/i18n';
import type { Sources } from '@/modules/reports/api/sources';
import type { ChartSpec, EnumName, FilterField, ReportColumn, ReportData, ReportFilters, ReportId, ReportNote, ReportRow, ReportValue, SummaryItem, ValueKind } from '@/modules/reports/types/reports';
import type { ReportAccess } from '@/modules/reports/utils/access';

/** What a report loader receives: the caller's access, the source APIs in the caller's scope, the filters and today. */
export interface LoadContext {
  access: ReportAccess;
  src: Sources;
  f: ReportFilters;
  today: string;
}

export interface ReportDefinition {
  id: ReportId;
  /** Filters that apply to this report (the others are not sent and not shown). */
  filters: FilterField[];
  /** Extra requirement beyond the category's access (e.g. personal details, offers). */
  requires?: (access: ReportAccess) => boolean;
  load: (ctx: LoadContext) => Promise<ReportData>;
}

export const col = (key: string, kind: ValueKind, enumName?: EnumName): ReportColumn => (enumName ? { key, kind, enum: enumName } : { key, kind });
export const item = (key: string, kind: ValueKind, value: ReportValue): SummaryItem => ({ key, kind, value });
export const note = (key: string, params?: ReportNote['params']): ReportNote => (params ? { key, params } : { key });

export function data(partial: Partial<ReportData> & Pick<ReportData, 'columns' | 'rows'>): ReportData {
  return { summary: [], chart: null, basis: [], limitations: [], currency: null, ...partial };
}

export function chart(type: ChartSpec['type'], valueKind: ChartSpec['valueKind'], categoryKind: ValueKind, categories: ReportValue[], series: ChartSpec['series'], categoryEnum?: EnumName): ChartSpec | null {
  if (!categories.length) return null;
  return categoryEnum ? { type, valueKind, categoryKind, categoryEnum, categories, series } : { type, valueKind, categoryKind, categories, series };
}

/** A person's full name in both languages. */
export const fullName = (name: { first: Localized<string>; last: Localized<string> }): Localized<string> => ({ en: `${name.first.en} ${name.last.en}`, ar: `${name.first.ar} ${name.last.ar}` });

/** Sort rows by a localized/text column (English order: stable regardless of the UI language). */
export function byText(key: string) {
  return (a: ReportRow, b: ReportRow) => text(a[key]).localeCompare(text(b[key]));
}
export const text = (v: ReportValue | undefined): string => (v === null || v === undefined ? '' : typeof v === 'object' ? v.en : String(v));

/** Grouped counts as rows sorted by count (largest first). */
export function sortByNumber(key: string) {
  return (a: ReportRow, b: ReportRow) => ((b[key] as number) ?? -1) - ((a[key] as number) ?? -1);
}

/** A label of the reports namespace in both languages (values grouped by a fixed category, e.g. age bands). */
export function label(key: string): Localized<string> {
  const t = (language: 'en' | 'ar') => i18n.getFixedT(language, 'reports')(key as never) as string;
  return { en: t('en'), ar: t('ar') };
}
