import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { SvgIconComponent } from '@mui/icons-material';
import BeachAccessOutlined from '@mui/icons-material/BeachAccessOutlined';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import DoNotDisturbOnOutlined from '@mui/icons-material/DoNotDisturbOnOutlined';
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined';
import HourglassEmptyOutlined from '@mui/icons-material/HourglassEmptyOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import TodayOutlined from '@mui/icons-material/TodayOutlined';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { ChartCard } from '@/modules/shared/charts/ChartCard';
import { EChart } from '@/modules/shared/charts/EChart';
import { CHART_HEIGHT } from '@/modules/shared/charts/layout';
import { useChartContext } from '@/modules/shared/charts/useChartContext';
import { visuallyHidden } from '@/modules/shared/styles';
import { departmentOption, monthlyOption, statusOption, typeOption, type StatusLabels } from '@/modules/leave/charts/options';
import { useLeaveSummary } from '@/modules/leave/hooks/useLeave';
import type { LeaveSummary } from '@/modules/leave/types/leave';
import { formatDays, todayIso } from '@/modules/leave/utils/format';

type KpiKey = 'total' | 'pending' | 'approved' | 'rejected' | 'onLeave' | 'daysUsed';

const KPIS: ReadonlyArray<{ key: KpiKey; icon: SvgIconComponent; color: 'primary' | 'success' | 'error' | 'warning' | 'info' | 'secondary'; value: (s: LeaveSummary) => number }> = [
  { key: 'total', icon: EventNoteOutlined, color: 'primary', value: (s) => s.total },
  { key: 'pending', icon: HourglassEmptyOutlined, color: 'warning', value: (s) => s.byStatus.pending },
  { key: 'approved', icon: CheckCircleOutlined, color: 'success', value: (s) => s.byStatus.approved },
  { key: 'rejected', icon: DoNotDisturbOnOutlined, color: 'error', value: (s) => s.byStatus.rejected },
  { key: 'onLeave', icon: BeachAccessOutlined, color: 'info', value: (s) => s.onLeaveToday },
  { key: 'daysUsed', icon: TodayOutlined, color: 'secondary', value: (s) => s.daysUsed },
];

/** KPIs and four charts of the current year — all computed by the API from the same leave requests. */
export function OverviewSection() {
  const { t } = useTranslation('leave');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const [year] = useState(() => Number(todayIso().slice(0, 4)));
  const query = useLeaveSummary(year);
  const ctx = useChartContext();
  const s = query.data;
  const statusLabels = useMemo<StatusLabels>(() => ({ approved: t('status.approved'), pending: t('status.pending'), rejected: t('status.rejected'), cancelled: t('status.cancelled') }), [t]);

  const options = useMemo(() => {
    if (!s) return null;
    return {
      status: statusOption(s.byStatus, ctx, statusLabels),
      monthly: monthlyOption(s.monthly, ctx, statusLabels),
      types: typeOption(s.byType, ctx, (days) => formatDays(t, days, ctx.language)),
      departments: departmentOption(s.byDepartment, ctx, t('charts.departments.series')),
    };
  }, [s, ctx, statusLabels, t]);

  if (query.isError) {
    return (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void query.refetch()}>{tCommon('actions.retry')}</Button>}>
        {tCommon('list.loadError')}
      </Alert>
    );
  }

  const chartQuery = { isPending: query.isPending, isError: false, refetch: query.refetch };
  const departmentHeight = { xs: Math.max(CHART_HEIGHT.xs, 40 + (s?.byDepartment.length ?? 6) * 34), md: Math.max(CHART_HEIGHT.md, 40 + (s?.byDepartment.length ?? 6) * 34) };

  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      <Box component="section" aria-label={t('kpis.label')}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t('kpis.period', { year: String(year) })}
        </Typography>
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(6, minmax(0, 1fr))' } }}>
          {KPIS.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Paper key={kpi.key} component="li" variant="outlined" sx={{ p: 2, position: 'relative', minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, pr: 3 }}>
                  <Box aria-hidden sx={(theme) => ({ display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 1.5, flexShrink: 0, color: `${kpi.color}.main`, bgcolor: theme.alpha((theme.vars ?? theme).palette[kpi.color].main, 0.12) })}>
                    <Icon fontSize="small" />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {t(`kpis.${kpi.key}`)}
                  </Typography>
                </Box>
                {query.isPending || !s ? (
                  <>
                    <Box component="span" role="status" sx={visuallyHidden}>
                      {tCommon('shell.loading')}
                    </Box>
                    <Skeleton width={56} height={36} />
                  </>
                ) : (
                  <Typography variant="h5" component="p" sx={{ fontWeight: 600 }} data-kpi={kpi.key}>
                    {formatNumber(kpi.value(s), language, { maximumFractionDigits: 1 })}
                  </Typography>
                )}
                <Tooltip title={t(`kpis.${kpi.key}Hint`)}>
                  <Box component="span" tabIndex={0} role="img" aria-label={t(`kpis.${kpi.key}Hint`)} sx={{ position: 'absolute', top: 10, right: 10, display: 'inline-flex', color: 'text.secondary' }}>
                    <InfoOutlined fontSize="small" />
                  </Box>
                </Tooltip>
              </Paper>
            );
          })}
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))' }}>
        <ChartCard id="leave-status" title={t('charts.status.title')} subtitle={t('charts.status.subtitle')} query={chartQuery} isEmpty={!s || s.total === 0}>
          {options && <EChart option={options.status} height={CHART_HEIGHT} label={t('charts.status.title')} />}
        </ChartCard>
        <ChartCard id="leave-monthly" title={t('charts.monthly.title')} subtitle={t('charts.monthly.subtitle')} query={chartQuery} isEmpty={!s || s.total === 0}>
          {options && <EChart option={options.monthly} height={CHART_HEIGHT} label={t('charts.monthly.title')} />}
        </ChartCard>
        <ChartCard id="leave-types" title={t('charts.types.title')} subtitle={t('charts.types.subtitle')} query={chartQuery} isEmpty={!s || s.byType.length === 0}>
          {options && <EChart option={options.types} height={CHART_HEIGHT} label={t('charts.types.title')} />}
        </ChartCard>
        <ChartCard id="leave-departments" title={t('charts.departments.title')} subtitle={t('charts.departments.subtitle')} query={chartQuery} isEmpty={!s || s.byDepartment.length === 0}>
          {options && <EChart option={options.departments} height={departmentHeight} label={t('charts.departments.title')} />}
        </ChartCard>
      </Box>
    </Box>
  );
}
