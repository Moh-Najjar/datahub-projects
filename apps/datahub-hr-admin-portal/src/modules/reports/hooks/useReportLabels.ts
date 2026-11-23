import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions, useLocations } from '@/modules/organization';
import type { ReportFilters, ReportId } from '@/modules/reports/types/reports';
import { enumLabel, formatDay } from '@/modules/reports/utils/format';
import { useReportScope } from './useReports';

/** A report title and description from the catalogue (`reports:catalog.<category>.<id>`). */
export function useReportTitle() {
  const { t } = useTranslation('reports');
  return (id: ReportId) => ({ title: t(`catalog.${id}.title` as never) as string, description: t(`catalog.${id}.description` as never) as string });
}

/** Department and location options (from Organization), limited to the caller's departments in team scope. */
export function useFilterOptions() {
  const { language } = useLanguage();
  const scope = useReportScope();
  const { options } = useDepartmentOptions();
  const locations = useLocations({ page: 1, pageSize: 100, sortBy: `name.${language}`, sortDirection: 'asc' });
  const departments = useMemo(() => {
    const allowed = scope.data?.departmentIds;
    return allowed ? options.filter((o) => allowed.includes(o.value)) : options;
  }, [options, scope.data]);
  const locationOptions = useMemo(() => (locations.data?.items ?? []).map((l) => ({ value: l.id, label: l.name[language] })), [locations.data, language]);
  return { departments, locations: locationOptions };
}

/** Human-readable list of the applied filters (screen and print). */
export function useDescribeFilters() {
  const { t } = useTranslation('reports');
  const { language } = useLanguage();
  const { departments, locations } = useFilterOptions();
  return (f: Partial<ReportFilters>): Array<{ label: string; value: string }> => {
    const out: Array<{ label: string; value: string }> = [];
    if (f.from && f.to) out.push({ label: t('filters.period'), value: `${formatDay(f.from, language)} – ${formatDay(f.to, language)}` });
    if (f.departmentId) out.push({ label: t('filters.department'), value: departments.find((d) => d.value === f.departmentId)?.label ?? f.departmentId });
    if (f.locationId) out.push({ label: t('filters.location'), value: locations.find((l) => l.value === f.locationId)?.label ?? f.locationId });
    if (f.employmentType) out.push({ label: t('filters.employmentType'), value: enumLabel(t, 'employmentType', f.employmentType) });
    if (f.employeeStatus) out.push({ label: t('filters.employeeStatus'), value: enumLabel(t, 'employeeStatus', f.employeeStatus) });
    return out;
  };
}
