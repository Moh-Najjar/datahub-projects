import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { INSIGHT_FILTERS, REPORTS, reportsOf } from '@/modules/reports/api/catalog';
import { canRunReport } from '@/modules/reports/api/reportsApi';
import { FILTER_KEYS, type FilterField, type ReportCategory, type ReportFilters, type ReportId } from '@/modules/reports/types/reports';
import { defaultFilters, filtersFromParams } from '@/modules/reports/utils/filters';
import { useReportsAccess } from './useReportsAccess';

/** The catalogue as the signed-in user may use it: reports per category and the filters each one takes. */
export function useReportCatalog() {
  const { access } = useReportsAccess();
  return useMemo(
    () => ({
      access,
      /** Reports of a category the user may run, in catalogue order. */
      reportsOf: (category: ReportCategory) => reportsOf(category).filter((id) => canRunReport(access, id)),
      canRun: (id: ReportId) => canRunReport(access, id),
      filtersOf: (id: ReportId | 'insights' | 'executive'): FilterField[] => (id === 'insights' || id === 'executive' ? INSIGHT_FILTERS : (REPORTS.get(id)?.filters ?? [])),
    }),
    [access],
  );
}

/**
 * Filters kept in the URL (`?from=…&to=…&departmentId=…`), so a report can be bookmarked, opened from a saved report
 * and restored with the browser's back button. Missing values fall back to the defaults (the last three months).
 */
export function useUrlFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const setFilters = useCallback(
    (next: ReportFilters) =>
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          for (const key of FILTER_KEYS) {
            if (next[key]) p.set(key, next[key]);
            else p.delete(key);
          }
          return p;
        },
        { replace: true },
      ),
    [setParams],
  );
  const reset = useCallback(() => setFilters(defaultFilters()), [setFilters]);
  return { filters, setFilters, reset, params, setParams };
}
