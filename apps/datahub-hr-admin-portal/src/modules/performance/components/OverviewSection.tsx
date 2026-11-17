import { useMemo } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { SvgIconComponent } from '@mui/icons-material';
import AssignmentIndOutlined from '@mui/icons-material/AssignmentIndOutlined';
import EventRepeatOutlined from '@mui/icons-material/EventRepeatOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import StarOutlineOutlined from '@mui/icons-material/StarOutlineOutlined';
import SupervisorAccountOutlined from '@mui/icons-material/SupervisorAccountOutlined';
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { ChartCard } from '@/modules/shared/charts/ChartCard';
import { EChart } from '@/modules/shared/charts/EChart';
import { CHART_HEIGHT } from '@/modules/shared/charts/layout';
import { useChartContext } from '@/modules/shared/charts/useChartContext';
import { visuallyHidden } from '@/modules/shared/styles';
import { completionOption, departmentOption, distributionOption, trendOption } from '@/modules/performance/charts/options';
import { usePerformanceSummary } from '@/modules/performance/hooks/usePerformance';
import type { PerformanceSummary } from '@/modules/performance/types/performance';

type KpiKey = 'inReview' | 'activeCycles' | 'pendingSelf' | 'pendingManager' | 'completed' | 'averageRating';

const KPIS: ReadonlyArray<{ key: KpiKey; icon: SvgIconComponent; color: 'primary' | 'success' | 'error' | 'warning' | 'info' | 'secondary' }> = [
  { key: 'inReview', icon: GroupsOutlined, color: 'primary' },
  { key: 'activeCycles', icon: EventRepeatOutlined, color: 'info' },
  { key: 'pendingSelf', icon: AssignmentIndOutlined, color: 'secondary' },
  { key: 'pendingManager', icon: SupervisorAccountOutlined, color: 'warning' },
  { key: 'completed', icon: TaskAltOutlined, color: 'success' },
  { key: 'averageRating', icon: StarOutlineOutlined, color: 'primary' },
];

/** KPIs and four charts — all computed by the API from the same reviews, on the configured rating scale. */
export function OverviewSection() {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const query = usePerformanceSummary();
  const ctx = useChartContext();
  const s = query.data;

  const options = useMemo(() => {
    if (!s) return null;
    const max = Math.max(...s.scale.map((l) => l.value));
    const levelLabel = (v: number) => `${v} — ${s.scale.find((l) => l.value === v)?.label[ctx.language] ?? ''}`;
    return {
      distribution: distributionOption(s.distribution, ctx, levelLabel, t('charts.reviews')),
      completion: completionOption(s.completion, ctx, { completed: t('reviewState.completed'), pendingManager: t('reviewState.pending-manager'), pendingSelf: t('reviewState.pending-self') }),
      departments: departmentOption(s.byDepartment, ctx, t('charts.averageRating'), max),
      trend: trendOption(s.trend, ctx, t('charts.averageRating'), max),
    };
  }, [s, ctx, t]);

  if (query.isError) {
    return (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void query.refetch()}>{tCommon('actions.retry')}</Button>}>
        {tCommon('list.loadError')}
      </Alert>
    );
  }
  const chartQuery = { isPending: query.isPending, isError: false, refetch: query.refetch };
  const value = (key: KpiKey, v: PerformanceSummary) => (key === 'averageRating' ? (v.averageRating === null ? '—' : formatNumber(v.averageRating, language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })) : formatNumber(v[key], language));

  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      <Box component="section" aria-label={t('kpis.label')}>
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(6, minmax(0, 1fr))' } }}>
          {KPIS.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Paper key={kpi.key} component="li" variant="outlined" sx={{ p: 2, position: 'relative', minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, pr: 3 }}>
                  <Box aria-hidden sx={(theme) => ({ display: 'grid', placeItems: 'center', width: 32, height: 32, flexShrink: 0, borderRadius: 1.5, color: `${kpi.color}.main`, bgcolor: theme.alpha((theme.vars ?? theme).palette[kpi.color].main, 0.12) })}>
                    <Icon fontSize="small" />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {t(`kpis.${kpi.key}`)}
                  </Typography>
                </Box>
                {!s ? (
                  <>
                    <Box component="span" role="status" sx={visuallyHidden}>
                      {tCommon('shell.loading')}
                    </Box>
                    <Skeleton width={56} height={36} />
                  </>
                ) : (
                  <Typography variant="h5" component="p" sx={{ fontWeight: 600 }} data-kpi={kpi.key}>
                    {value(kpi.key, s)}
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
        <ChartCard id="perf-distribution" title={t('charts.distribution.title')} subtitle={t('charts.distribution.subtitle')} query={chartQuery} isEmpty={!s || s.distribution.every((d) => d.count === 0)}>
          {options && <EChart option={options.distribution} height={CHART_HEIGHT} label={t('charts.distribution.title')} />}
        </ChartCard>
        <ChartCard id="perf-completion" title={t('charts.completion.title')} subtitle={t('charts.completion.subtitle')} query={chartQuery} isEmpty={!s || s.completion.length === 0}>
          {options && <EChart option={options.completion} height={CHART_HEIGHT} label={t('charts.completion.title')} />}
        </ChartCard>
        <ChartCard id="perf-departments" title={t('charts.departments.title')} subtitle={t('charts.departments.subtitle')} query={chartQuery} isEmpty={!s || s.byDepartment.length === 0}>
          {options && <EChart option={options.departments} height={CHART_HEIGHT} label={t('charts.departments.title')} />}
        </ChartCard>
        <ChartCard id="perf-trend" title={t('charts.trend.title')} subtitle={t('charts.trend.subtitle')} query={chartQuery} isEmpty={!s || s.trend.every((x) => x.average === null)}>
          {options && <EChart option={options.trend} height={CHART_HEIGHT} label={t('charts.trend.title')} />}
        </ChartCard>
      </Box>
    </Box>
  );
}
