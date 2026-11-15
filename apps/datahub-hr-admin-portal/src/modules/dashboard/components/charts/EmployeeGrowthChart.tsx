import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { employeeGrowthOption } from '@/modules/dashboard/charts/options';
import { useChartContext } from '@/modules/dashboard/hooks/useChartContext';
import { useEmployeeGrowth } from '@/modules/dashboard/hooks/useDashboard';
import type { DashboardScope } from '@/modules/dashboard/types/dashboard';
import { CHART_HEIGHT } from '@/modules/dashboard/charts/layout';
import { ChartCard } from './ChartCard';
import { EChart } from './EChart';

/** Headcount over the last 12 months (line), with the previous year for comparison. */
export function EmployeeGrowthChart({ scope }: { scope: DashboardScope }) {
  const { t } = useTranslation('dashboard');
  const ctx = useChartContext();
  const query = useEmployeeGrowth(scope);
  const option = useMemo(
    () => (query.data ? employeeGrowthOption(query.data, ctx, { headcount: t('charts.employeeGrowth.headcount'), previousYear: t('charts.employeeGrowth.previousYear') }) : null),
    [query.data, ctx, t],
  );
  const title = t('charts.employeeGrowth.title');

  return (
    <ChartCard id="chart-growth" title={title} subtitle={t('charts.employeeGrowth.subtitle')} query={query} isEmpty={!query.data?.months.length}>
      {option && <EChart option={option} height={CHART_HEIGHT} label={title} />}
    </ChartCard>
  );
}
