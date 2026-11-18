import { useMemo, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { SvgIconComponent } from '@mui/icons-material';
import ArchiveOutlined from '@mui/icons-material/ArchiveOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined';
import HourglassBottomOutlined from '@mui/icons-material/HourglassBottomOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import PendingActionsOutlined from '@mui/icons-material/PendingActionsOutlined';
import TaskOutlined from '@mui/icons-material/TaskOutlined';
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
import { categoryOption, departmentOption, expiryOption, statusOption } from '@/modules/documents/charts/options';
import { useDocumentsOverview } from '@/modules/documents/hooks/useDocuments';
import { documentPaths } from '@/modules/documents/paths';
import type { DocumentsOverview, DocumentSummary } from '@/modules/documents/types/documents';
import { formatDay, formatMonth } from '@/modules/documents/utils/format';
import { Code } from './common/Chips';

type KpiKey = keyof DocumentsOverview['totals'];
const KPIS: ReadonlyArray<{ key: KpiKey; icon: SvgIconComponent; color: 'primary' | 'success' | 'error' | 'warning' | 'info' | 'secondary' }> = [
  { key: 'total', icon: DescriptionOutlined, color: 'primary' },
  { key: 'active', icon: TaskOutlined, color: 'success' },
  { key: 'expiringSoon', icon: HourglassBottomOutlined, color: 'warning' },
  { key: 'expired', icon: EventBusyOutlined, color: 'error' },
  { key: 'pendingReview', icon: PendingActionsOutlined, color: 'info' },
  { key: 'archived', icon: ArchiveOutlined, color: 'secondary' },
];

/** KPIs, four charts and attention lists — all computed by the API from the same documents, in the caller's scope. */
export function OverviewSection() {
  const { t } = useTranslation('documents');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const query = useDocumentsOverview();
  const ctx = useChartContext();
  const o = query.data;

  const options = useMemo(() => {
    if (!o) return null;
    return {
      category: categoryOption(o.byCategory, ctx, t('charts.documents'), t('charts.other')),
      expiry: expiryOption(o.expiry.months, ctx, t('charts.expiring'), (m) => formatMonth(m, ctx.language)),
      status: statusOption(o.byStatus, ctx, (s) => t(`status.${s}`)),
      department: departmentOption(o.byDepartment, ctx, t('charts.documents')),
    };
  }, [o, ctx, t]);

  if (query.isError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => void query.refetch()}>
            {tCommon('actions.retry')}
          </Button>
        }
      >
        {tCommon('list.loadError')}
      </Alert>
    );
  }
  const chartQuery = { isPending: query.isPending, isError: false, refetch: query.refetch };
  const empty = Boolean(o) && o!.totals.total === 0;
  const list = (title: string, rows: DocumentSummary[] | undefined, detail: (d: DocumentSummary) => ReactNode, more: string, emptyText: string) => (
    <Panel title={title} actions={<Button size="small" component={RouterLink} to={more}>{t('actions.viewAll')}</Button>}>
      {!rows ? (
        <Skeleton variant="rounded" height={120} />
      ) : rows.length === 0 ? (
        <Typography color="text.secondary">{emptyText}</Typography>
      ) : (
        <Stack component="ul" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label={title}>
          {rows.map((d) => (
            <Box component="li" key={d.id} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 1, minWidth: 0 }}>
              <Link component={RouterLink} to={documentPaths.document(d.id)} underline="hover" sx={{ fontWeight: 500, minWidth: 0, overflowWrap: 'anywhere' }}>
                {d.name}
              </Link>
              <Typography variant="body2" color="text.secondary">
                {d.owner.name[language]}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ marginInlineStart: 'auto' }}>
                {detail(d)}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Panel>
  );

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
                {!o ? (
                  <>
                    <Box component="span" role="status" sx={visuallyHidden}>
                      {tCommon('shell.loading')}
                    </Box>
                    <Skeleton width={56} height={36} />
                  </>
                ) : (
                  <Typography variant="h5" component="p" sx={{ fontWeight: 600 }} data-kpi={kpi.key}>
                    {formatNumber(o.totals[kpi.key], language)}
                  </Typography>
                )}
                <Tooltip title={t(`kpis.${kpi.key}Hint`, { days: o?.expiry.thresholdDays ?? 30 })}>
                  <Box component="span" tabIndex={0} role="img" aria-label={t(`kpis.${kpi.key}Hint`, { days: o?.expiry.thresholdDays ?? 30 })} sx={{ position: 'absolute', top: 10, right: 10, display: 'inline-flex', color: 'text.secondary' }}>
                    <InfoOutlined fontSize="small" />
                  </Box>
                </Tooltip>
              </Paper>
            );
          })}
        </Box>
      </Box>

      {empty && <Alert severity="info">{t('overview.empty')}</Alert>}

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))' }}>
        <ChartCard id="docs-category" title={t('charts.category.title')} subtitle={t('charts.category.subtitle')} query={chartQuery} isEmpty={!o || o.byCategory.length === 0}>
          {options && <EChart option={options.category} height={CHART_HEIGHT} label={t('charts.category.title')} />}
        </ChartCard>
        <ChartCard id="docs-expiry" title={t('charts.expiry.title')} subtitle={t('charts.expiry.subtitle')} query={chartQuery} isEmpty={!o || o.expiry.months.every((m) => m.count === 0)}>
          {options && <EChart option={options.expiry} height={CHART_HEIGHT} label={t('charts.expiry.title')} />}
        </ChartCard>
        <ChartCard id="docs-status" title={t('charts.status.title')} subtitle={t('charts.status.subtitle')} query={chartQuery} isEmpty={!o || o.totals.total === 0}>
          {options && <EChart option={options.status} height={CHART_HEIGHT} label={t('charts.status.title')} />}
        </ChartCard>
        <ChartCard id="docs-department" title={t('charts.department.title')} subtitle={t('charts.department.subtitle')} query={chartQuery} isEmpty={!o || o.byDepartment.length === 0}>
          {options && <EChart option={options.department} height={CHART_HEIGHT} label={t('charts.department.title')} />}
        </ChartCard>
      </Box>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' } }}>
        {list(t('overview.expired'), o?.attention.expired, (d) => t('overview.expiredOn', { date: formatDay(d.expiryDate!, language) }), documentPaths.expiry, t('overview.noneExpired'))}
        {list(t('overview.expiringSoon', { days: o?.expiry.thresholdDays ?? 30 }), o?.attention.expiringSoon, (d) => (d.daysRemaining === 0 ? t('overview.today') : t('overview.inDays', { days: d.daysRemaining })), documentPaths.expiry, t('overview.noneExpiring'))}
        {list(t('overview.pendingReview'), o?.attention.pendingReview, (d) => formatDay(d.uploadedAt, language), `${documentPaths.directory}?status=pending-review`, t('overview.nonePending'))}
        <Panel title={t('overview.missing', { number: o?.attention.missingTotal ?? 0 })} actions={<Button size="small" component={RouterLink} to={documentPaths.required}>{t('actions.viewAll')}</Button>}>
          {!o ? (
            <Skeleton variant="rounded" height={120} />
          ) : o.attention.missing.length === 0 ? (
            <Typography color="text.secondary">{t('overview.noneMissing')}</Typography>
          ) : (
            <Stack component="ul" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label={t('overview.missingLabel')}>
              {o.attention.missing.map((m) => (
                <Box component="li" key={`${m.employee.id}-${m.rule.id}`} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'baseline' }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {m.employee.name[language]}
                  </Typography>
                  <Code>{m.employee.employeeNumber}</Code>
                  <Typography variant="body2" color="text.secondary" sx={{ marginInlineStart: 'auto' }}>
                    {m.rule.name[language]}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Panel>
      </Box>
    </Box>
  );
}
