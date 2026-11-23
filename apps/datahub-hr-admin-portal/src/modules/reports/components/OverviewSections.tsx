import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { isApiError } from '@/core/api/types';
import { Panel } from '@/modules/shared/Panel';
import { useReportCatalog, useUrlFilters } from '@/modules/reports/hooks/useReportCatalog';
import { useExecutiveDashboard, useHRInsights, useReportsOverview } from '@/modules/reports/hooks/useReports';
import { OVERVIEW_CHARTS, type ReportResult } from '@/modules/reports/types/reports';
import { relevantFilters } from '@/modules/reports/utils/filters';
import { ReportFiltersBar } from './filters/ReportFiltersBar';
import { FigureChart, KpiGrid } from './overview/Figures';
import { ReportView } from './view/ReportView';

const OVERVIEW_FIELDS = ['dateRange', 'departmentId', 'locationId', 'employmentType', 'employeeStatus'] as const;

function QueryError({ query }: { query: UseQueryResult<unknown> }) {
  const { t } = useTranslation('reports');
  const { t: tc } = useTranslation();
  const e = query.error;
  if (isApiError(e) && e.code === 'VALIDATION') {
    const reason = Object.values(e.fieldErrors ?? {})[0]?.[0] ?? 'invalid';
    return <Alert severity="warning">{t('view.fixFilters', { reason: t(`validation.${reason}` as never, { defaultValue: reason }) as string })}</Alert>;
  }
  return (
    <Alert
      severity="error"
      action={
        <Button color="inherit" size="small" onClick={() => void query.refetch()}>
          {tc('actions.retry')}
        </Button>
      }
    >
      {t('view.loadError')}
    </Alert>
  );
}

/** `/reports`: eight key figures and seven charts, each from its source module, within the user's scope. */
export function OverviewSection() {
  const { t } = useTranslation('reports');
  const { filters, setFilters, reset } = useUrlFilters();
  const query = useReportsOverview(relevantFilters(filters, [...OVERVIEW_FIELDS]));
  const errors = isApiError(query.error) && query.error.code === 'VALIDATION' ? query.error.fieldErrors : undefined;
  const retry = () => void query.refetch();
  const loading = query.isPending || (query.isFetching && query.isPlaceholderData);
  return (
    <Box sx={{ display: 'grid', gap: 2.5, minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <Panel title={t('filters.label')} subtitle={t('overview.filtersHint')}>
        <ReportFiltersBar fields={[...OVERVIEW_FIELDS]} value={filters} onChange={setFilters} onReset={reset} errors={errors} />
      </Panel>
      {query.isError && !query.data ? (
        <QueryError query={query} />
      ) : (
        <>
          <KpiGrid kpis={query.data?.kpis} loading={loading} onRetry={retry} />
          <Box component="section" aria-label={t('overview.chartsLabel')} sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' } }}>
            {OVERVIEW_CHARTS.map((key) => (
              <FigureChart key={key} chart={query.data?.charts.find((c) => c.key === key) ?? { key, status: 'available', chart: null }} loading={loading} onRetry={retry} />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}

/** `/reports/insights`: department comparison across modules — association, never causation. */
export function InsightsSection() {
  const { t } = useTranslation('reports');
  const catalog = useReportCatalog();
  const { filters, setFilters, reset } = useUrlFilters();
  const fields = catalog.filtersOf('insights');
  const f = relevantFilters(filters, fields);
  const query = useHRInsights(f);
  const errors = isApiError(query.error) && query.error.code === 'VALIDATION' ? query.error.fieldErrors : undefined;
  return (
    <Box sx={{ display: 'grid', gap: 2.5, minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <Alert severity="info">
        {t('insights.intro')} <strong>{t('insights.notCausation')}</strong>
      </Alert>
      <Panel title={t('filters.label')}>
        <ReportFiltersBar fields={fields} value={filters} onChange={setFilters} onReset={reset} errors={errors} />
      </Panel>
      <ReportView query={query} title={t('catalog.insights.departments.title')} description={t('catalog.insights.departments.description')} exportRequest={{ kind: 'insights', filters: f }} saveInput={null} />
    </Box>
  );
}

/** `/reports/executive`: organisation-level figures for leadership (aggregates only). */
export function ExecutiveSection() {
  const { t } = useTranslation('reports');
  const catalog = useReportCatalog();
  const { filters, setFilters, reset } = useUrlFilters();
  const fields = catalog.filtersOf('executive');
  const f = relevantFilters(filters, fields);
  const query = useExecutiveDashboard(f);
  const errors = isApiError(query.error) && query.error.code === 'VALIDATION' ? query.error.fieldErrors : undefined;
  const loading = query.isPending || (query.isFetching && query.isPlaceholderData);
  const d = query.data;
  // The departments table is a report of its own: same view (print, records, notes).
  const departments = {
    ...query,
    data: d ? ({ ...d.departments, id: 'executive.dashboard', category: 'executive', filters: d.filters, generatedAt: d.generatedAt } satisfies ReportResult) : undefined,
  } as UseQueryResult<ReportResult>;
  return (
    <Box sx={{ display: 'grid', gap: 2.5, minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <Alert severity="info">{t('executive.intro')}</Alert>
      <Panel title={t('filters.label')}>
        <ReportFiltersBar fields={fields} value={filters} onChange={setFilters} onReset={reset} errors={errors} />
      </Panel>
      {query.isError && !d ? (
        <QueryError query={query} />
      ) : (
        <>
          <KpiGrid kpis={d?.kpis} loading={loading} onRetry={() => void query.refetch()} />
          <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(3, minmax(0, 1fr))' } }}>
            {(['headcount', 'attendance', 'payroll'] as const).map((key) => (
              <FigureChart key={key} chart={d?.charts.find((c) => c.key === key) ?? { key, status: 'available', chart: null }} loading={loading} onRetry={() => void query.refetch()} />
            ))}
          </Box>
          <ReportView query={departments} title={t('executive.departments')} description={t('catalog.insights.departments.description')} exportRequest={{ kind: 'executive', filters: f }} saveInput={null} />
        </>
      )}
    </Box>
  );
}
