import type { BuilderConfig, ReportColumn, ReportRow, ReportValue } from '@/modules/reports/types/reports';
import { average, groupBy } from './calculations';

/*
 * Report builder: projects, groups and sorts the rows of an EXISTING report (its dataset). No free-form queries —
 * only the dataset's own columns, which already contain only what the caller may see.
 */

const GROUPABLE = new Set<ReportColumn['kind']>(['text', 'localized', 'enum', 'code', 'month', 'date']);
const SUMMABLE = new Set<ReportColumn['kind']>(['number', 'money', 'hours']);
const AVERAGED = new Set<ReportColumn['kind']>(['percent', 'rating', 'decimal']);

export const canGroupBy = (c: ReportColumn) => GROUPABLE.has(c.kind);
export const isAggregatable = (c: ReportColumn) => SUMMABLE.has(c.kind) || AVERAGED.has(c.kind);

/** Field errors of a configuration against the dataset's columns (empty when valid). */
export function builderErrors(config: Pick<BuilderConfig, 'fields' | 'groupBy' | 'sortBy'>, columns: readonly ReportColumn[]): Record<string, string[]> {
  const keys = new Set(columns.map((c) => c.key));
  const errors: Record<string, string[]> = {};
  if (!config.fields.length) errors.fields = ['required'];
  else if (config.fields.some((f) => !keys.has(f))) errors.fields = ['notAllowed'];
  if (config.groupBy !== null) {
    const g = columns.find((c) => c.key === config.groupBy);
    if (!g || !canGroupBy(g)) errors.groupBy = ['notAllowed'];
  }
  if (config.sortBy !== null && config.sortBy !== 'rows' && !keys.has(config.sortBy)) errors.sortBy = ['notAllowed'];
  return errors;
}

const sortKey = (v: ReportValue) => (v === null ? null : typeof v === 'object' ? v.en : v);
function compare(a: ReportValue, b: ReportValue): number {
  const x = sortKey(a);
  const y = sortKey(b);
  if (x === null && y === null) return 0;
  if (x === null) return 1; // missing values last, whatever the direction
  if (y === null) return -1;
  return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
}

export function sortRows(rows: ReportRow[], key: string | null, direction: 'asc' | 'desc'): ReportRow[] {
  if (!key) return rows;
  return [...rows].sort((a, b) => {
    const x = a[key] ?? null;
    const y = b[key] ?? null;
    if (x === null || y === null) return compare(x, y);
    return direction === 'asc' ? compare(x, y) : compare(y, x);
  });
}

/** The builder's result: selected columns, optionally one row per group (row count, sums, averages). */
export function buildCustom(config: Pick<BuilderConfig, 'fields' | 'groupBy' | 'sortBy' | 'sortDirection'>, columns: readonly ReportColumn[], rows: readonly ReportRow[]): { columns: ReportColumn[]; rows: ReportRow[] } {
  const selected = config.fields.map((key) => columns.find((c) => c.key === key)!).filter(Boolean);
  if (config.groupBy === null) {
    const projected = rows.map((r) => Object.fromEntries(selected.map((c) => [c.key, r[c.key] ?? null])) as ReportRow);
    return { columns: selected, rows: sortRows(projected, config.sortBy, config.sortDirection) };
  }
  const group = columns.find((c) => c.key === config.groupBy)!;
  const measures = selected.filter((c) => c.key !== group.key && isAggregatable(c));
  const groups = groupBy(rows, (r) => JSON.stringify(r[group.key] ?? null));
  const out = [...groups.values()].map((g) => {
    const row: ReportRow = { [group.key]: g[0]![group.key] ?? null, rows: g.length };
    for (const m of measures) {
      const values = g.map((r) => r[m.key]).filter((v): v is number => typeof v === 'number');
      row[m.key] = values.length === 0 ? null : SUMMABLE.has(m.kind) ? values.reduce((s, v) => s + v, 0) : average(values);
    }
    return row;
  });
  return { columns: [group, { key: 'rows', kind: 'number' }, ...measures], rows: sortRows(out, config.sortBy ?? 'rows', config.sortBy ? config.sortDirection : 'desc') };
}
