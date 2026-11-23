import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { CHART_HEIGHT } from '@/modules/shared/charts/layout';
import type { OverviewChart, OverviewKpi } from '@/modules/reports/types/reports';
import { formatNote, formatValue, isLtrKind } from '@/modules/reports/utils/format';
import { ReportChart } from '../view/parts';

/** Key figures. A figure that is restricted, has no data or failed says so — it is never shown as 0. */
export function KpiGrid({ kpis, loading, onRetry }: { kpis: OverviewKpi[] | undefined; loading: boolean; onRetry: () => void }) {
  const { t } = useTranslation('reports');
  const { language } = useLanguage();
  return (
    <Box component="ul" aria-label={t('overview.label')} sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
      {(kpis ?? Array.from({ length: 8 }, () => null)).map((k, i) => (
        <Paper key={k?.key ?? i} component="li" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {!k || loading ? (
            <>
              <Skeleton width="60%" />
              <Skeleton width="40%" height={36} />
            </>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                {t(`overview.kpis.${k.key}`)}
              </Typography>
              {k.status === 'available' ? (
                <Typography variant="h5" component="p" data-kpi={k.key} sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} dir={isLtrKind(k.kind) ? 'ltr' : undefined}>
                  {k.kind === 'money' ? `JOD ${formatValue(t, language, k.kind, k.value)}` : formatValue(t, language, k.kind, k.value)}
                </Typography>
              ) : (
                <Box data-kpi-status={`${k.key}:${k.status}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary', minHeight: 32 }}>
                  {k.status === 'restricted' && <LockOutlined fontSize="small" aria-hidden />}
                  <Typography variant="body2" component="p">
                    {t(`overview.status.${k.status}`)}
                  </Typography>
                  {k.status === 'error' && (
                    <Button size="small" onClick={onRetry}>
                      {t('overview.retry')}
                    </Button>
                  )}
                </Box>
              )}
              {k.basis && k.status === 'available' && (
                <Typography variant="caption" color="text.secondary">
                  {formatNote(t, language, k.basis)}
                </Typography>
              )}
            </>
          )}
        </Paper>
      ))}
    </Box>
  );
}

/** One overview chart with its own availability state. */
export function FigureChart({ chart, loading, onRetry }: { chart: OverviewChart | undefined; loading: boolean; onRetry: () => void; }) {
  const { t } = useTranslation('reports');
  if (!chart) return null;
  const title = t(`overview.charts.${chart.key}.title`);
  let body;
  if (loading) body = <Skeleton variant="rounded" sx={{ height: CHART_HEIGHT }} />;
  else if (chart.status === 'available' && chart.chart) body = <ReportChart spec={chart.chart} title={title} />;
  else
    body = (
      <Box sx={{ height: CHART_HEIGHT, display: 'grid', placeItems: 'center', textAlign: 'center', color: 'text.secondary', gap: 1 }}>
        <Box>
          {chart.status === 'restricted' && <LockOutlined aria-hidden />}
          <Typography>{t(`overview.status.${chart.status === 'available' ? 'no-data' : chart.status}`)}</Typography>
          {chart.status === 'error' && (
            <Button size="small" onClick={onRetry}>
              {t('overview.retry')}
            </Button>
          )}
        </Box>
      </Box>
    );
  return (
    <Paper variant="outlined" component="section" aria-label={title} sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
      <Typography variant="h6" component="h2">
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, mb: 2, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        {t(`overview.charts.${chart.key}.subtitle`)}
      </Typography>
      {body}
    </Paper>
  );
}
