import type { ListParams, Paginated } from '@/core/api/types';

export interface CollectionOptions<T, TFilters extends object> {
  /** Fields matched (case-insensitively) by `params.search`. */
  searchFields?: ReadonlyArray<keyof T>;
  /**
   * Custom filter predicate. Without it, each non-empty filter must equal the item's field of the
   * same name (arrays in filters match any of their values).
   */
  matches?: (item: T, filters: Partial<TFilters>) => boolean;
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

function defaultMatches<T>(item: T, filters: object): boolean {
  return Object.entries(filters).every(([key, expected]) => {
    if (isEmpty(expected)) return true;
    const actual = (item as Record<string, unknown>)[key];
    return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
  });
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1; // empty values last
  if (b === undefined || b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
}

/**
 * Applies search → filters → sort → pagination to an in-memory list, the way a real list endpoint
 * would. Out-of-range pages return an empty page; `pageSize` is clamped to 1–100.
 */
export function queryCollection<T, TFilters extends object>(
  items: readonly T[],
  params: ListParams<TFilters>,
  options: CollectionOptions<T, TFilters> = {},
): Paginated<T> {
  const search = params.search?.trim().toLowerCase();
  let result = items.filter((item) => {
    if (search && options.searchFields?.length) {
      const hit = options.searchFields.some((field) => String(item[field] ?? '').toLowerCase().includes(search));
      if (!hit) return false;
    }
    const filters = params.filters ?? {};
    return options.matches ? options.matches(item, filters) : defaultMatches(item, filters);
  });

  if (params.sortBy) {
    const key = params.sortBy as keyof T;
    const sign = params.sortDirection === 'desc' ? -1 : 1;
    result = [...result].sort((a, b) => sign * compare(a[key], b[key]));
  }

  const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize)));
  const page = Math.max(1, Math.floor(params.page));
  const start = (page - 1) * pageSize;
  return {
    items: result.slice(start, start + pageSize),
    page,
    pageSize,
    total: result.length,
    totalPages: Math.ceil(result.length / pageSize),
  };
}
