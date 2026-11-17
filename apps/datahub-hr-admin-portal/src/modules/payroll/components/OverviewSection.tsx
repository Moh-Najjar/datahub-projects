import { useMemo } from 'react';
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
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import HourglassTopOutlined from '@mui/icons-material/HourglassTopOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import PendingActionsOutlined from '@mui/icons-material/PendingActionsOutlined';
import RemoveCircleOutlineOutlined from '@mui/icons-material/RemoveCircleOutlineOutlined';
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
import { costTrendOption, departmentCostOption, grossNetOption, salaryRangeOption } from '@/modules/payroll/charts/options';
import { usePayrollSummary } from '@/modules/payroll/hooks/usePayroll';
import { payrollPaths } from '@/modules/payroll/paths';
import type { PayrollSummary } from '@/modules/payroll/types/payroll';
import { formatPeriod, formatTimestamp } from '@/modules/payroll/utils/format';
import { RunStatusChip } from './common/Chips';
import { Code, Money } from './common/Money';

type KpiKey = 'totalEmployees' | 'gross' | 'net' | 'deductions' | 'pendingRuns' | 'awaitingApproval';

const KPIS: ReadonlyArray<{ key: KpiKey; icon: SvgIconComponent; color: 'primary' | 'success' | 'error' | 'warning' | 'info' | 'secondary' }> = [
  { key: 'totalEmployees', icon: GroupsOutlined, color: 'primary' },
  { key: 'gross', icon: PaymentsOutlined, color: 'info' },
  { key: 'net', icon: AccountBalanceWalletOutlined, color: 'success' },
  { key: 'deductions', icon: RemoveCircleOutlineOutlined, color: 'secondary' },
  { key: 'pendingRuns', icon: PendingActionsOutlined, color: 'warning' },
  { key: 'awaitingApproval', icon: HourglassTopOutlined, color: 'error' },
];

/** KPIs, the current period, four charts and recent activity — all computed by the API from the same payroll runs. */
export function OverviewSection() {
  const { t } = useTranslation('payroll');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const query = usePayrollSummary();
  const ctx = useChartContext();
  const s = query.data;

  const options = useMemo(() => {
    if (!s) return null;
    return {
      cost: costTrendOption(s.monthly, s.currency, ctx, { basic: t('fields.basic'), allowances: t('fields.allowances'), overtime: t('fields.overtime'), employees: t('fields.employees') }),
      grossNet: grossNetOption(s.monthly, s.currency, ctx, { gross: t('fields.gross'), net: t('fields.net') }),
      departments: departmentCostOption(s.byDepartment, s.currency, ctx, t('fields.gross'), t('fields.employees')),
      ranges: salaryRangeOption(s.salaryRanges, s.currency, ctx, t('fields.employees')),
    };
  }, [s, ctx, t]);

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
  const value = (key: KpiKey, v: PayrollSummary) => {
    if (key === 'gross' || key === 'net' || key === 'deductions') return v.latest ? <Money value={v.latest[key]} currency={v.currency} /> : '—';
    return formatNumber(v[key], language);
  };
  const noPayroll = Boolean(s) && s!.monthly.every((m) => m.employees === 0);

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
                    <Skeleton width={96} height={36} />
                  </>
                ) : (
                  <Typography variant="h6" component="p" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }} data-kpi={kpi.key}>
                    {value(kpi.key, s)}
                  </Typography>
                )}
                {s?.latest && (kpi.key === 'gross' || kpi.key === 'net' || kpi.key === 'deductions') && (
                  <Typography variant="caption" color="text.secondary">
                    {formatPeriod(s.latest.month, language)}
                  </Typography>
                )}
                <Tooltip title={t(`kpis.${kpi.key}Hint`)}>
                  <Box component="span" tabIndex={0} role="img" aria-label={t(`kpis.${kpi.key}Hint`)} sx={{ position: 'absolute', top: 10, insetInlineEnd: 10, display: 'inline-flex', color: 'text.secondary' }}>
                    <InfoOutlined fontSize="small" />
                  </Box>
                </Tooltip>
              </Paper>
            );
          })}
        </Box>
      </Box>

      {s && (
        <Panel title={t('overview.currentPeriod', { period: formatPeriod(s.currentPeriod.month, language) })} subtitle={t('overview.currentPeriodHint')}>
          {s.currentPeriod.runs.length === 0 ? (
            <Typography color="text.secondary">{t('overview.noCurrentRuns')}</Typography>
          ) : (
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))' }}>
              {s.currentPeriod.runs.map((r) => (
                <Paper key={r.id} component="li" variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Link component={RouterLink} to={payrollPaths.run(r.id)} underline="hover" sx={{ fontWeight: 600 }}>
                      <Code>{r.number}</Code>
                    </Link>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {r.department?.name[language] ?? t('common.allDepartments')}
                    </Typography>
                  </Box>
                  <RunStatusChip status={r.status} />
                </Paper>
              ))}
            </Box>
          )}
        </Panel>
      )}

      {noPayroll && <Alert severity="info">{t('overview.noPayroll')}</Alert>}

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))' }}>
        <ChartCard id="payroll-cost" title={t('charts.cost.title')} subtitle={t('charts.cost.subtitle', { currency: s?.currency ?? '' })} query={chartQuery} isEmpty={!s || noPayroll}>
          {options && <EChart option={options.cost} height={CHART_HEIGHT} label={t('charts.cost.title')} />}
        </ChartCard>
        <ChartCard id="payroll-gross-net" title={t('charts.grossNet.title')} subtitle={t('charts.grossNet.subtitle', { currency: s?.currency ?? '' })} query={chartQuery} isEmpty={!s || noPayroll}>
          {options && <EChart option={options.grossNet} height={CHART_HEIGHT} label={t('charts.grossNet.title')} />}
        </ChartCard>
        <ChartCard id="payroll-departments" title={t('charts.departments.title')} subtitle={s?.latest ? t('charts.departments.subtitle', { period: formatPeriod(s.latest.month, language) }) : t('charts.departments.empty')} query={chartQuery} isEmpty={!s || s.byDepartment.length === 0}>
          {options && <EChart option={options.departments} height={CHART_HEIGHT} label={t('charts.departments.title')} />}
        </ChartCard>
        <ChartCard id="payroll-ranges" title={t('charts.ranges.title')} subtitle={t('charts.ranges.subtitle', { currency: s?.currency ?? '' })} query={chartQuery} isEmpty={!s || s.totalEmployees === 0}>
          {options && <EChart option={options.ranges} height={CHART_HEIGHT} label={t('charts.ranges.title')} />}
        </ChartCard>
      </Box>

      <Panel title={t('overview.activity')}>
        {!s ? (
          <Skeleton variant="rounded" height={120} />
        ) : s.recentActivity.length === 0 ? (
          <Typography color="text.secondary">{t('overview.noActivity')}</Typography>
        ) : (
          <Stack component="ol" spacing={1.25} sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label={t('overview.activity')}>
            {s.recentActivity.map((a) => (
              <Box component="li" key={`${a.runId}-${a.at}-${a.action}`} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                <Link component={RouterLink} to={payrollPaths.run(a.runId)} underline="hover">
                  <Code>{a.runNumber}</Code>
                </Link>
                <Typography variant="body2">{t(`history.${a.action}` as never, { by: a.by[language], number: a.note })}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ marginInlineStart: 'auto' }}>
                  {formatTimestamp(a.at, language)}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Panel>
    </Box>
  );
}
