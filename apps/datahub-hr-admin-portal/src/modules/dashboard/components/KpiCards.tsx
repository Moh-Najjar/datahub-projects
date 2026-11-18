import type { ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { SvgIconComponent } from '@mui/icons-material';
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import HowToRegOutlined from '@mui/icons-material/HowToRegOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import PeopleAltOutlined from '@mui/icons-material/PeopleAltOutlined';
import PersonAddAlt1Outlined from '@mui/icons-material/PersonAddAlt1Outlined';
import RemoveRounded from '@mui/icons-material/RemoveRounded';
import WorkOutlineOutlined from '@mui/icons-material/WorkOutlineOutlined';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/core/context/authContext';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { WIDGET_ACCESS } from '@/modules/dashboard/access';
import { useDashboardSummary } from '@/modules/dashboard/hooks/useDashboard';
import type { DashboardScope, DashboardSummary, Kpi } from '@/modules/dashboard/types/dashboard';
import { kpiChange } from '@/modules/dashboard/utils/kpi';

type KpiKey = 'totalEmployees' | 'activeEmployees' | 'newHires' | 'onLeaveToday' | 'attendanceRate' | 'openPositions';

interface KpiDefinition {
  key: KpiKey;
  icon: SvgIconComponent;
  access: readonly (typeof WIDGET_ACCESS)[keyof typeof WIDGET_ACCESS][number][];
  kind: 'count' | 'rate';
  /** Whether an increase is good (green), bad (red) or neither (neutral colour). */
  goodWhen: 'up' | 'down' | 'neither';
  compareWith: 'vsLastMonth' | 'vsYesterday';
  color: 'primary' | 'secondary' | 'info' | 'warning' | 'success';
}

const KPIS: readonly KpiDefinition[] = [
  { key: 'totalEmployees', icon: PeopleAltOutlined, access: WIDGET_ACCESS.headcount, kind: 'count', goodWhen: 'neither', compareWith: 'vsLastMonth', color: 'primary' },
  { key: 'activeEmployees', icon: HowToRegOutlined, access: WIDGET_ACCESS.headcount, kind: 'count', goodWhen: 'neither', compareWith: 'vsLastMonth', color: 'secondary' },
  { key: 'newHires', icon: PersonAddAlt1Outlined, access: WIDGET_ACCESS.headcount, kind: 'count', goodWhen: 'neither', compareWith: 'vsLastMonth', color: 'info' },
  { key: 'onLeaveToday', icon: EventBusyOutlined, access: WIDGET_ACCESS.leave, kind: 'count', goodWhen: 'neither', compareWith: 'vsYesterday', color: 'warning' },
  { key: 'attendanceRate', icon: FactCheckOutlined, access: WIDGET_ACCESS.attendance, kind: 'rate', goodWhen: 'up', compareWith: 'vsYesterday', color: 'success' },
  { key: 'openPositions', icon: WorkOutlineOutlined, access: WIDGET_ACCESS.recruitment, kind: 'count', goodWhen: 'neither', compareWith: 'vsLastMonth', color: 'primary' },
];

/** The KPIs this role may see (permission) that exist in this scope (e.g. open positions: organisation only). */
function visibleKpis(summary: DashboardSummary | undefined, canAny: (p: readonly KpiDefinition['access'][number][]) => boolean) {
  return KPIS.filter((k) => canAny(k.access) && (!summary || summary[k.key] !== undefined));
}

function Trend({ kpi, def }: { kpi: Kpi; def: KpiDefinition }) {
  const { t } = useTranslation('dashboard');
  const { language } = useLanguage();
  const change = kpiChange(kpi, def.kind);
  if (!change) {
    return (
      <Typography variant="caption" color="text.secondary">
        {t('trend.noComparison')}
      </Typography>
    );
  }
  const signed = { signDisplay: 'exceptZero' as const, maximumFractionDigits: 1 };
  const text = def.kind === 'rate' ? t('trend.points', { value: formatNumber(change.value, language, signed) }) : formatNumber(change.value, language, { ...signed, style: 'percent' });
  const sentiment = change.direction === 'flat' || def.goodWhen === 'neither' ? 'neutral' : change.direction === def.goodWhen ? 'good' : 'bad';
  const color = sentiment === 'good' ? 'success.main' : sentiment === 'bad' ? 'error.main' : 'text.secondary';
  const Icon = change.direction === 'up' ? ArrowUpwardRounded : change.direction === 'down' ? ArrowDownwardRounded : RemoveRounded;

  return (
    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', mt: 'auto' }}>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color, fontWeight: 600, fontSize: 13 }}>
        <Icon sx={{ fontSize: 16 }} aria-label={t(`trend.${change.direction}`)} />
        {/* Pure numbers stay LTR (sign before digits); the rate text includes a translated unit, so it keeps the page direction. */}
        <span dir={def.kind === 'count' ? 'ltr' : undefined}>{text}</span>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {t(`trend.${def.compareWith}`)}
      </Typography>
    </Box>
  );
}

function KpiCard({ def, kpi, value }: { def: KpiDefinition; kpi: Kpi; value: ReactNode }) {
  const { t } = useTranslation('dashboard');
  const Icon = def.icon;
  return (
    <Paper variant="outlined" component="li" sx={{ p: 2.25, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1.25, minHeight: 148 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box
          aria-hidden="true"
          sx={(theme) => ({
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 1,
            display: 'grid',
            placeItems: 'center',
            color: `${def.color}.main`,
            bgcolor: theme.alpha((theme.vars ?? theme).palette[def.color].main, 0.12),
          })}
        >
          <Icon fontSize="small" />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, fontWeight: 500 }}>
          {t(`kpis.${def.key}.label`)}
        </Typography>
        <Tooltip title={t(`kpis.${def.key}.tooltip`)}>
          <IconButton size="small" aria-label={`${t('kpis.info')}: ${t(`kpis.${def.key}.label`)}`} sx={{ m: -0.5 }}>
            <InfoOutlined sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Typography variant="h3" component="p" sx={{ fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }} data-kpi={def.key}>
        {value}
      </Typography>
      <Trend kpi={kpi} def={def} />
    </Paper>
  );
}

/** Headline indicators with comparison to the previous period, filtered by the role's permissions. */
export function KpiCards({ scope }: { scope: DashboardScope }) {
  const { t } = useTranslation('dashboard');
  const { t: tc } = useTranslation();
  const { language } = useLanguage();
  const { canAny } = useAuth();
  const candidates = visibleKpis(undefined, canAny);
  const query = useDashboardSummary(scope, candidates.length > 0);
  if (candidates.length === 0) return null;

  const grid = { m: 0, p: 0, display: 'grid', gap: 2, alignItems: 'stretch', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))' };

  return (
    <Box component="section" aria-labelledby="kpis-title" sx={{ mb: 3 }}>
      <Typography id="kpis-title" variant="h6" component="h2" sx={{ mb: 1.5 }}>
        {t('kpis.title')}
      </Typography>
      {query.isPending && (
        <Box sx={grid} role="status" aria-label={tc('shell.loading')}>
          {candidates.map((k) => (
            <Skeleton key={k.key} variant="rounded" height={128} />
          ))}
        </Box>
      )}
      {query.isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void query.refetch()}>
              {tc('actions.retry')}
            </Button>
          }
        >
          {tc('apiErrors.SERVER')}
        </Alert>
      )}
      {query.data && (
        <Box component="ul" sx={grid}>
          {visibleKpis(query.data, canAny).map((def) => {
            const kpi = query.data[def.key]!;
            const value = def.kind === 'rate' ? formatNumber(kpi.current / 100, language, { style: 'percent', maximumFractionDigits: 1 }) : formatNumber(kpi.current, language);
            return <KpiCard key={def.key} def={def} kpi={kpi} value={value} />;
          })}
        </Box>
      )}
    </Box>
  );
}
