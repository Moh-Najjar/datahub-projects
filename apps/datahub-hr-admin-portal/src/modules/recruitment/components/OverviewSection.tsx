import { useMemo } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { SvgIconComponent } from '@mui/icons-material';
import EventOutlined from '@mui/icons-material/EventOutlined';
import PersonAddAltOutlined from '@mui/icons-material/PersonAddAltOutlined';
import HowToRegOutlined from '@mui/icons-material/HowToRegOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import LocalOfferOutlined from '@mui/icons-material/LocalOfferOutlined';
import PeopleAltOutlined from '@mui/icons-material/PeopleAltOutlined';
import WorkOutlineOutlined from '@mui/icons-material/WorkOutlineOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { ChartCard } from '@/modules/shared/charts/ChartCard';
import { EChart } from '@/modules/shared/charts/EChart';
import { CHART_HEIGHT } from '@/modules/shared/charts/layout';
import { useChartContext } from '@/modules/shared/charts/useChartContext';
import { Panel } from '@/modules/shared/Panel';
import { visuallyHidden } from '@/modules/shared/styles';
import { activityOption, funnelOption, requisitionOption, stageOption } from '@/modules/recruitment/charts/options';
import { useRecruitmentAccess } from '@/modules/recruitment/hooks/useRecruitmentAccess';
import { useRecruitmentSummary } from '@/modules/recruitment/hooks/useRecruitment';
import { recruitmentPaths } from '@/modules/recruitment/paths';
import { CANDIDATE_STAGES, type RecruitmentSummary } from '@/modules/recruitment/types/recruitment';
import { formatTimestamp, personName } from '@/modules/recruitment/utils/format';

type KpiKey = 'openPositions' | 'totalCandidates' | 'newCandidates' | 'inInterview' | 'pendingOffers' | 'hired';

const KPIS: ReadonlyArray<{ key: KpiKey; icon: SvgIconComponent; color: 'primary' | 'success' | 'error' | 'warning' | 'info' | 'secondary' }> = [
  { key: 'openPositions', icon: WorkOutlineOutlined, color: 'primary' },
  { key: 'totalCandidates', icon: PeopleAltOutlined, color: 'secondary' },
  { key: 'newCandidates', icon: PersonAddAltOutlined, color: 'info' },
  { key: 'inInterview', icon: EventOutlined, color: 'primary' },
  { key: 'pendingOffers', icon: LocalOfferOutlined, color: 'warning' },
  { key: 'hired', icon: HowToRegOutlined, color: 'success' },
];

/** KPIs, four charts and recent activity — all computed by the API from the same recruitment records. */
export function OverviewSection() {
  const { t } = useTranslation('recruitment');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canSeeOffers } = useRecruitmentAccess();
  const query = useRecruitmentSummary();
  const ctx = useChartContext();
  const s = query.data;

  const options = useMemo(() => {
    if (!s) return null;
    return {
      stages: stageOption(s.byStage, ctx, CANDIDATE_STAGES, (st) => t(`stages.${st}`), t('charts.candidates')),
      activity: activityOption(s.monthly, ctx, { applications: t('charts.activity.applications'), interviews: t('charts.activity.interviews'), offers: t('charts.activity.offers'), hires: t('charts.activity.hires') }),
      requisitions: requisitionOption(s.byRequisition, ctx, { active: t('charts.byRequisition.active'), hired: t('charts.byRequisition.hired'), other: t('charts.byRequisition.other') }),
      funnel: funnelOption(s.funnel, ctx, (step) => t(`funnel.${step}`), t('charts.candidates')),
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
  const rowsHeight = (n: number) => ({ xs: Math.max(CHART_HEIGHT.xs, 50 + n * 34), md: Math.max(CHART_HEIGHT.md, 50 + n * 34) });
  const value = (key: KpiKey, v: RecruitmentSummary) => v[key];

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
                    {formatNumber(value(kpi.key, s), language)}
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
        <ChartCard id="rec-stages" title={t('charts.stages.title')} subtitle={t('charts.stages.subtitle')} query={chartQuery} isEmpty={!s || s.totalCandidates === 0}>
          {options && <EChart option={options.stages} height={rowsHeight(CANDIDATE_STAGES.length)} label={t('charts.stages.title')} />}
        </ChartCard>
        <ChartCard id="rec-activity" title={t('charts.activity.title')} subtitle={t('charts.activity.subtitle')} query={chartQuery} isEmpty={!s || s.monthly.every((m) => m.applications + m.interviews + m.offers + m.hires === 0)}>
          {options && <EChart option={options.activity} height={CHART_HEIGHT} label={t('charts.activity.title')} />}
        </ChartCard>
        <ChartCard id="rec-requisitions" title={t('charts.byRequisition.title')} subtitle={t('charts.byRequisition.subtitle')} query={chartQuery} isEmpty={!s || s.byRequisition.length === 0}>
          {options && <EChart option={options.requisitions} height={rowsHeight(s?.byRequisition.length ?? 6)} label={t('charts.byRequisition.title')} />}
        </ChartCard>
        <ChartCard id="rec-funnel" title={t('charts.funnel.title')} subtitle={t('charts.funnel.subtitle')} query={chartQuery} isEmpty={!s || (s.funnel[0]?.count ?? 0) === 0}>
          {options && <EChart option={options.funnel} height={CHART_HEIGHT} label={t('charts.funnel.title')} />}
        </ChartCard>
      </Box>

      <Panel title={t('activity.title')} subtitle={canSeeOffers ? t('activity.subtitle') : t('activity.teamSubtitle')}>
        {!s ? (
          <Skeleton height={120} />
        ) : s.recent.length === 0 ? (
          <Typography color="text.secondary">{t('activity.empty')}</Typography>
        ) : (
          <Box component="ol" aria-label={t('activity.title')} sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.25 }}>
            {s.recent.map((a, i) => (
              <Box component="li" key={`${a.at}-${i}`} sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1, alignItems: 'baseline' }}>
                <Link component={RouterLink} to={recruitmentPaths.candidate(a.candidate.id)} sx={{ fontWeight: 500 }}>
                  {personName(a.candidate.name, language)}
                </Link>
                <Typography variant="body2">{a.type === 'stage' && a.to ? t('activity.movedTo', { stage: t(`stages.${a.to}`) }) : t(`events.${a.type}`, { from: '', to: a.to ? t(`stages.${a.to}`) : '' })}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {a.requisition.title[language]} · {formatTimestamp(a.at, language)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Panel>
    </Box>
  );
}
