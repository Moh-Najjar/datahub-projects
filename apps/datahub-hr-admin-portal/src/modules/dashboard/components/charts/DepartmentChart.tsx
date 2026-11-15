import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { departmentOption } from '@/modules/dashboard/charts/options';
import { useChartContext } from '@/modules/dashboard/hooks/useChartContext';
import { useDepartmentHeadcount } from '@/modules/dashboard/hooks/useDashboard';
import { ChartCard } from './ChartCard';
import { EChart } from './EChart';

/** Employees per department (horizontal bars, largest first). Organisation scope only. */
export function DepartmentChart() {
  const { t } = useTranslation('dashboard');
  const ctx = useChartContext();
  const query = useDepartmentHeadcount();
  const option = useMemo(() => (query.data ? departmentOption(query.data, ctx, t('charts.departments.series')) : null), [query.data, ctx, t]);
  const title = t('charts.departments.title');
  // Taller with more departments so bars and labels stay readable.
  const height = Math.max(240, (query.data?.departments.length ?? 0) * 34 + 40);

  return (
    <ChartCard id="chart-departments" title={title} subtitle={t('charts.departments.subtitle')} query={query} isEmpty={!query.data?.departments.length}>
      {option && <EChart option={option} height={height} label={title} />}
    </ChartCard>
  );
}
