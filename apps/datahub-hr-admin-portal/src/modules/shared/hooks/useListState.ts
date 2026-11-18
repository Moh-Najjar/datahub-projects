import { useEffect, useMemo, useState } from 'react';
import type { ListParams, SortDirection } from '@/core/api/types';

export interface ListState<TFilters extends object, TSort extends string> {
  params: ListParams<TFilters>;
  search: string;
  setSearch: (value: string) => void;
  filters: Partial<TFilters>;
  setFilter: <K extends keyof TFilters>(key: K, value: TFilters[K] | undefined) => void;
  clearFilters: () => void;
  hasFilters: boolean;
  sortBy: TSort;
  sortDirection: SortDirection;
  /** Sort by `field`; clicking the active field again flips the direction. */
  toggleSort: (field: TSort) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

export const PAGE_SIZES = [10, 25, 50] as const;

/** Wait this long after the last keystroke before searching (one request per pause, not per key). */
export const SEARCH_DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * UI state of a server-side list (search, filters, sort, 1-based page) turned into `ListParams`.
 * Changing the search, a filter, the sort or the page size goes back to page 1. The search term is
 * debounced; TanStack Query caches each resulting page.
 */
export function useListState<TFilters extends object, TSort extends string>(
  defaultSort: TSort,
  defaultDirection: SortDirection = 'asc',
  /** Optional starting search / filters (e.g. from the URL), so the FIRST request is already filtered. */
  initial: { search?: string; filters?: Partial<TFilters> } = {},
): ListState<TFilters, TSort> {
  const [search, setSearchValue] = useState(initial.search ?? '');
  const [filters, setFilters] = useState<Partial<TFilters>>(initial.filters ?? {});
  const [sortBy, setSortBy] = useState<TSort>(defaultSort);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeValue] = useState<number>(PAGE_SIZES[0]);
  const deferredSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);

  const params = useMemo<ListParams<TFilters>>(
    () => ({ page, pageSize, search: deferredSearch || undefined, sortBy, sortDirection, filters }),
    [page, pageSize, deferredSearch, sortBy, sortDirection, filters],
  );

  return {
    params,
    search,
    setSearch: (value) => {
      setSearchValue(value);
      setPage(1);
    },
    filters,
    setFilter: (key, value) => {
      setFilters((current) => {
        const next = { ...current };
        if (value === undefined || value === '') delete next[key];
        else next[key] = value;
        return next;
      });
      setPage(1);
    },
    clearFilters: () => {
      setFilters({});
      setSearchValue('');
      setPage(1);
    },
    hasFilters: Boolean(search.trim()) || Object.keys(filters).length > 0,
    sortBy,
    sortDirection,
    toggleSort: (field) => {
      if (field === sortBy) setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      else {
        setSortBy(field);
        setSortDirection('asc');
      }
      setPage(1);
    },
    setPage,
    setPageSize: (size) => {
      setPageSizeValue(size);
      setPage(1);
    },
  };
}
