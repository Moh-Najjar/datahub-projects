import { useMemo } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { EChart } from '@/modules/shared/charts/EChart';
import { CHART_HEIGHT } from '@/modules/shared/charts/layout';
import { useChartContext } from '@/modules/shared/charts/useChartContext';
import { reportChartOption } from '@/modules/reports/charts/options';
import type { ChartSpec, ReportNote, SummaryItem } from '@/modules/reports/types/reports';
import { chartCategories, chartValueText, formatNote, formatValue, isLtrKind, label } from '@/modules/reports/utils/format';

/** Chart of a report (ECharts, SVG). Horizontal bars grow with their number of categories. */
export function ReportChart({ spec, title }: { spec: ChartSpec; title: string }) {
  const { t } = useTranslation('reports');
  const { language } = useLanguage();
  const ctx = useChartContext();
  const option = useMemo(() => {
    const { exact, axis } = chartValueText(language, spec);
    return reportChartOption(spec, ctx, { series: (k) => label(t, k), categories: chartCategories(t, language, spec), value: exact, axis });
  }, [spec, ctx, t, language]);
  const height = spec.type === 'hbar' ? Math.max(CHART_HEIGHT.xs, spec.categories.length * 30 + 48) : CHART_HEIGHT;
  return <EChart option={option} height={height} label={title} />;
}

/** The report's key figures. */
export function SummaryTiles({ items, label: ariaLabel }: { items: SummaryItem[]; label: string }) {
  const { t } = useTranslation('reports');
  const { language } = useLanguage();
  if (!items.length) return null;
  return (
    <Box component="dl" aria-label={ariaLabel} sx={{ m: 0, display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(auto-fill, minmax(170px, 1fr))' } }}>
      {items.map((s) => {
        const text = formatValue(t, language, s.kind, s.value);
        return (
          <Box key={s.key} sx={{ p: 1.5, borderRadius: 1, border: 1, borderColor: 'divider', bgcolor: 'background.default', minWidth: 0 }}>
            <Typography component="dt" variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {label(t, s.key)}
            </Typography>
            <Typography component="dd" variant="h6" sx={{ m: 0, mt: 0.25, fontVariantNumeric: 'tabular-nums', color: s.value === null ? 'text.disabled' : undefined }} dir={isLtrKind(s.kind) ? 'ltr' : undefined}>
              {s.value === null ? t('view.unavailable') : s.kind === 'money' ? `JOD ${text}` : text}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

/** "How this is calculated" and "Limitations". */
export function ReportNotes({ basis, limitations }: { basis: ReportNote[]; limitations: ReportNote[] }) {
  const { t } = useTranslation('reports');
  const { language } = useLanguage();
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      {limitations.length > 0 && (
        <Alert severity="warning" variant="outlined">
          <Typography variant="subtitle2" component="h3">
            {t('view.limitations')}
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {limitations.map((n, i) => (
              <li key={`${n.key}-${i}`}>{formatNote(t, language, n)}</li>
            ))}
          </Box>
        </Alert>
      )}
      {basis.length > 0 && (
        <Box component="section" aria-label={t('view.basis')}>
          <Typography variant="subtitle2" component="h3" color="text.secondary">
            {t('view.basis')}
          </Typography>
          <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5, color: 'text.secondary', typography: 'body2' }}>
            {basis.map((n, i) => (
              <li key={`${n.key}-${i}`}>{formatNote(t, language, n)}</li>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
