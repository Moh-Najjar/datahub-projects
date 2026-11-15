import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { attendanceOption } from '@/modules/dashboard/charts/options';
import { useChartContext } from '@/modules/dashboard/hooks/useChartContext';
import { useAttendanceOverview } from '@/modules/dashboard/hooks/useDashboard';
import type { DashboardScope } from '@/modules/dashboard/types/dashboard';
import { CHART_HEIGHT } from '@/modules/dashboard/charts/layout';
import { ChartCard } from './ChartCard';
import { EChart } from './EChart';

/** Today's attendance split as a doughnut (present / late / absent / on leave). */
export function AttendanceChart({ scope }: { scope: DashboardScope }) {
  const { t } = useTranslation('dashboard');
  const ctx = useChartContext();
  const query = useAttendanceOverview(scope);
  const option = useMemo(
    () =>
      query.data
        ? attendanceOption(query.data, ctx, {
            present: t('charts.attendance.present'),
            late: t('charts.attendance.late'),
            absent: t('charts.attendance.absent'),
            onLeave: t('charts.attendance.onLeave'),
          })
        : null,
    [query.data, ctx, t],
  );
  const total = query.data ? query.data.present + query.data.late + query.data.absent + query.data.onLeave : 0;
  const title = t('charts.attendance.title');

  return (
    <ChartCard id="chart-attendance" title={title} subtitle={t('charts.attendance.subtitle')} query={query} isEmpty={total === 0}>
      {option && <EChart option={option} height={CHART_HEIGHT} label={title} />}
    </ChartCard>
  );
}
