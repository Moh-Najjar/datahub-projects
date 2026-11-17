import { useMemo } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { SvgIconComponent } from '@mui/icons-material';
import BeachAccessOutlined from '@mui/icons-material/BeachAccessOutlined';
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined';
import HowToRegOutlined from '@mui/icons-material/HowToRegOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import PeopleAltOutlined from '@mui/icons-material/PeopleAltOutlined';
import PercentOutlined from '@mui/icons-material/PercentOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { ChartCard } from '@/modules/shared/charts/ChartCard';
import { EChart } from '@/modules/shared/charts/EChart';
import { CHART_HEIGHT } from '@/modules/shared/charts/layout';
import { useChartContext } from '@/modules/shared/charts/useChartContext';
import { visuallyHidden } from '@/modules/shared/styles';
import { departmentOption, distributionOption, monthlyOption, trendOption, type StatusLabels } from '@/modules/attendance/charts/options';
import { useAttendanceSummary } from '@/modules/attendance/hooks/useAttendance';
import { ATTENDANCE_STATUSES, type AttendanceSummary } from '@/modules/attendance/types/attendance';
import { formatDay } from '@/modules/attendance/utils/format';

type KpiKey = 'total' | 'present' | 'absent' | 'late' | 'onLeave' | 'rate';

const KPIS: ReadonlyArray<{ key: KpiKey; icon: SvgIconComponent; color: 'primary' | 'success' | 'error' | 'warning' | 'info' | 'secondary'; value: (s: AttendanceSummary) => number | null; percent?: boolean }> = [
  { key: 'total', icon: PeopleAltOutlined, color: 'primary', value: (s) => s.totalEmployees },
  { key: 'present', icon: HowToRegOutlined, color: 'success', value: (s) => s.present },
  { key: 'absent', icon: EventBusyOutlined, color: 'error', value: (s) => s.absent },
  { key: 'late', icon: ScheduleOutlined, color: 'warning', value: (s) => s.late },
  { key: 'onLeave', icon: BeachAccessOutlined, color: 'info', value: (s) => s.onLeave },
  { key: 'rate', icon: PercentOutlined, color: 'secondary', value: (s) => s.attendanceRate, percent: true },
];

/** Today's KPIs and the four charts — all computed from the same attendance records by the API. */
export function OverviewSection() {
  const { t } = useTranslation('attendance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const query = useAttendanceSummary();
  const ctx = useChartContext();
  const s = query.data;
  const statusLabels = useMemo(() => Object.fromEntries(ATTENDANCE_STATUSES.map((st) => [st, t(`status.${st}`)])) as StatusLabels, [t]);

  const options = useMemo(() => {
    if (!s) return null;
    return {
      trend: trendOption(s.trend, ctx, statusLabels),
      distribution: distributionOption(s.today, ctx, statusLabels),
      departments: departmentOption(s.byDepartment, ctx, { onTime: statusLabels.present, late: statusLabels.late, absent: statusLabels.absent, onLeave: statusLabels['on-leave'] }),
      monthly: monthlyOption(s.monthly, ctx, { rate: t('charts.monthly.rate'), hours: t('charts.monthly.hours') }),
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
  const departmentHeight = { xs: Math.max(CHART_HEIGHT.xs, 60 + (s?.byDepartment.length ?? 6) * 34), md: Math.max(CHART_HEIGHT.md, 60 + (s?.byDepartment.length ?? 6) * 34) };

  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      <Box component="section" aria-label={t('kpis.label')}>
        {s && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {formatDay(s.date, language, { dateStyle: 'full' })}
          </Typography>
        )}
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(6, minmax(0, 1fr))' } }}>
          {KPIS.map((kpi) => {
            const Icon = kpi.icon;
            const value = s ? kpi.value(s) : null;
            return (
              <Paper key={kpi.key} component="li" variant="outlined" sx={{ p: 2, position: 'relative', minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, pr: 3 }}>
                  <Box aria-hidden sx={(theme) => ({ display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 1.5, color: `${kpi.color}.main`, bgcolor: theme.alpha((theme.vars ?? theme).palette[kpi.color].main, 0.12) })}>
                    <Icon fontSize="small" />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {t(`kpis.${kpi.key}`)}
                  </Typography>
                </Box>
                {query.isPending ? (
                  <>
                    <Box component="span" role="status" sx={visuallyHidden}>
                      {tCommon('shell.loading')}
                    </Box>
                    <Skeleton width={56} height={36} />
                  </>
                ) : value === null ? (
                  <Typography color="text.secondary" data-kpi={kpi.key}>
                    {t('kpis.notDue')}
                  </Typography>
                ) : (
                  <Typography variant="h5" component="p" sx={{ fontWeight: 600 }} data-kpi={kpi.key}>
                    {kpi.percent ? formatNumber(value, language, { style: 'percent', maximumFractionDigits: 1 }) : formatNumber(value, language)}
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
        <ChartCard id="att-trend" title={t('charts.trend.title')} subtitle={t('charts.trend.subtitle')} query={chartQuery} isEmpty={!s?.trend.some((d) => ATTENDANCE_STATUSES.some((st) => d[st] > 0))}>
          {options && <EChart option={options.trend} height={CHART_HEIGHT} label={t('charts.trend.title')} />}
        </ChartCard>
        <ChartCard id="att-distribution" title={t('charts.distribution.title')} subtitle={t('charts.distribution.subtitle')} query={chartQuery} isEmpty={!s || s.scheduled === 0}>
          {options && <EChart option={options.distribution} height={CHART_HEIGHT} label={t('charts.distribution.title')} />}
        </ChartCard>
        <ChartCard id="att-departments" title={t('charts.departments.title')} subtitle={t('charts.departments.subtitle')} query={chartQuery} isEmpty={!s || s.byDepartment.length === 0}>
          {options && <EChart option={options.departments} height={departmentHeight} label={t('charts.departments.title')} />}
        </ChartCard>
        <ChartCard id="att-monthly" title={t('charts.monthly.title')} subtitle={t('charts.monthly.subtitle')} query={chartQuery} isEmpty={!s || s.monthly.every((m) => m.records === 0)}>
          {options && <EChart option={options.monthly} height={CHART_HEIGHT} label={t('charts.monthly.title')} />}
        </ChartCard>
      </Box>
    </Box>
  );
}
