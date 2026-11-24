import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ListParams, SortDirection } from '@/core/api/types';

export interface ListState<F extends object> {
  /** Parameters for the API call (debounced search). */
  params: ListParams<F>;
  /** What the search box shows right now (not debounced). */
  searchInput: string;
  setSearchInput: (value: string) => void;
  filters: Partial<F>;
  setFilter: <K extends keyof F>(key: K, value: F[K] | undefined) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  sortBy: string | undefined;
  sortDirection: SortDirection;
  setSort: (sortBy: string) => void;
}

interface Options<F extends object> {
  pageSize?: number;
  initialSort?: { sortBy: string; sortDirection: SortDirection };
  initialFilters?: Partial<F>;
  /** Milliseconds the search box waits before it queries (default 300). */
  debounceMs?: number;
}

/**
 * State of one server-driven list: 1-based page, page size, debounced search, filters and sorting.
 * Changing the search, a filter or the page size returns to page 1.
 */
export function useListState<F extends object = Record<string, never>>(options: Options<F> = {}): ListState<F> {
  const { pageSize: initialPageSize = 10, initialSort, initialFilters, debounceMs = 300 } = options;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Partial<F>>(initialFilters ?? {});
  const [sortBy, setSortBy] = useState<string | undefined>(initialSort?.sortBy);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSort?.sortDirection ?? 'asc');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [searchInput, debounceMs]);

  const setFilter = useCallback(<K extends keyof F>(key: K, value: F[K] | undefined) => {
    setFilters((current) => {
      const next = { ...current };
      if (value === undefined || (value as unknown) === '') delete next[key];
      else next[key] = value;
      return next;
    });
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchInput('');
    setSearch('');
    setPage(1);
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  const setSort = useCallback(
    (key: string) => {
      if (key === sortBy) setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      else {
        setSortBy(key);
        setSortDirection('asc');
      }
      setPage(1);
    },
    [sortBy],
  );

  const params = useMemo<ListParams<F>>(
    () => ({ page, pageSize, search: search || undefined, sortBy, sortDirection, filters: Object.keys(filters).length ? filters : undefined }),
    [page, pageSize, search, sortBy, sortDirection, filters],
  );

  return {
    params,
    searchInput,
    setSearchInput,
    filters,
    setFilter,
    clearFilters,
    hasActiveFilters: Object.keys(filters).length > 0 || search !== '',
    page,
    pageSize,
    setPage,
    setPageSize,
    sortBy,
    sortDirection,
    setSort,
  };
}
