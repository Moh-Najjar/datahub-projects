import type { ReportFilters, ReportId, ReportTab } from '@/modules/reports/types/reports';
import { filtersToParams } from '@/modules/reports/utils/filters';

/** URLs of Reports & Analytics (`/reports/*`). The language is never part of the URL. */
export const reportPaths = {
  overview: '/reports',
  tab: (tab: Exclude<ReportTab, 'overview'>) => `/reports/${tab}`,
  /** A catalogue report with its filters (and the saved report it was opened from). */
  report: (id: ReportId, filters?: ReportFilters, savedId?: string) => {
    const [category] = id.split('.');
    const params = new URLSearchParams({ report: id, ...(filters ? filtersToParams(filters) : {}), ...(savedId ? { saved: savedId } : {}) });
    return `/reports/${category}?${params.toString()}`;
  },
  builder: (savedId?: string) => (savedId ? `/reports/builder?saved=${encodeURIComponent(savedId)}` : '/reports/builder'),
};
