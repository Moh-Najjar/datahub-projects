import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { leaveOption } from '@/modules/dashboard/charts/options';
import { useChartContext } from '@/modules/shared/charts/useChartContext';
import { useLeaveOverview } from '@/modules/dashboard/hooks/useDashboard';
import type { DashboardScope } from '@/modules/dashboard/types/dashboard';
import { CHART_HEIGHT } from '@/modules/shared/charts/layout';
import { ChartCard } from '@/modules/shared/charts/ChartCard';
import { EChart } from '@/modules/shared/charts/EChart';

/** Leave requests per month (last 6 months), stacked by current status. */
export function LeaveChart({ scope }: { scope: DashboardScope }) {
  const { t } = useTranslation('dashboard');
  const ctx = useChartContext();
  const query = useLeaveOverview(scope);
  const option = useMemo(
    () =>
      query.data
        ? leaveOption(query.data, ctx, {
            pending: t('charts.leave.pending'),
            approved: t('charts.leave.approved'),
            rejected: t('charts.leave.rejected'),
            cancelled: t('charts.leave.cancelled'),
            total: t('charts.leave.total'),
          })
        : null,
    [query.data, ctx, t],
  );
  const isEmpty = !query.data?.months.some((m) => m.pending + m.approved + m.rejected + m.cancelled > 0);
  const title = t('charts.leave.title');

  return (
    <ChartCard id="chart-leave" title={title} subtitle={t('charts.leave.subtitle')} query={query} isEmpty={isEmpty}>
      {option && <EChart option={option} height={CHART_HEIGHT} label={title} />}
    </ChartCard>
  );
}
