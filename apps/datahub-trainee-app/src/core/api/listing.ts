import type { ListParams, Paginated } from './types';

/*
 * List helpers for endpoints that return whole collections (search → filters → sort → 1-based pagination). Used by the
 * simulated backend and by HTTP services whose endpoint does not page or filter on the server yet.
 */

export interface QueryOptions<T, F extends object> {
  searchFields: (item: T) => (string | null | undefined)[];
  matches?: (item: T, filters: Partial<F>) => boolean;
  sorters?: Record<string, (a: T, b: T) => number>;
  defaultSort?: (a: T, b: T) => number;
}

export const normalizeText = (value: string): string => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();

export function queryCollection<T, F extends object = Record<string, never>>(items: readonly T[], params: ListParams<F>, options: QueryOptions<T, F>): Paginated<T> {
  const needle = normalizeText(params.search ?? '');
  let rows = [...items];
  if (needle) rows = rows.filter((item) => options.searchFields(item).some((field) => field && normalizeText(field).includes(needle)));
  if (params.filters && options.matches) {
    const filters = Object.fromEntries(Object.entries(params.filters).filter(([, v]) => v !== undefined && v !== '' && v !== null)) as Partial<F>;
    rows = rows.filter((item) => options.matches!(item, filters));
  }
  const compare = (params.sortBy && options.sorters?.[params.sortBy]) || options.defaultSort;
  if (compare) {
    const direction = params.sortDirection === 'desc' ? -1 : 1;
    rows.sort((a, b) => compare(a, b) * direction);
  }
  return paginate(rows, params.page, params.pageSize);
}

export function paginate<T>(rows: readonly T[], page: number, pageSize: number): Paginated<T> {
  const size = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), totalPages);
  return { items: rows.slice((current - 1) * size, current * size), page: current, pageSize: size, total: rows.length, totalPages };
}
