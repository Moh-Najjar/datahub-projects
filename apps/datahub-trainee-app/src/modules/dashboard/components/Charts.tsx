import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { fill } from '@/i18n';
import { formatNumber, formatPercent } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import type { StatusBreakdown, TrainingProgressEntry } from '../types/dashboard';

/**
 * Two small, dependency-free charts. Every value is also written as text next to its bar, so colour is never the
 * only way to read them.
 */

const SEGMENTS = [
  { key: 'assigned', color: '#8e9aab' },
  { key: 'inProgress', color: '#1456c8' },
  { key: 'completed', color: '#24843d' },
] as const;

/** Enrollments by status: one stacked bar and a legend with the counts. */
export function StatusBreakdownChart({ data }: { data: StatusBreakdown }) {
  const t = useT();
  const { locale } = useLocale();
  const total = data.assigned + data.inProgress + data.completed;
  const labels = { assigned: t.enums.enrollmentStatus.assigned, inProgress: t.enums.enrollmentStatus['in-progress'], completed: t.enums.enrollmentStatus.completed };

  return (
    <Box>
      <Box
        role="img"
        aria-label={SEGMENTS.map((s) => `${labels[s.key]}: ${formatNumber(data[s.key], locale)}`).join(', ')}
        sx={{ display: 'flex', height: 18, borderRadius: 0.5, overflow: 'hidden', bgcolor: 'grey.100' }}
        dir="ltr"
      >
        {total > 0 &&
          SEGMENTS.map((s) => (data[s.key] > 0 ? <Box key={s.key} sx={{ width: `${(data[s.key] / total) * 100}%`, bgcolor: s.color }} /> : null))}
      </Box>
      <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: 'wrap', mt: 2 }}>
        {SEGMENTS.map((s) => (
          <Stack key={s.key} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: s.color }} />
            <Typography variant="body2" color="text.secondary">
              {labels[s.key]}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {formatNumber(data[s.key], locale)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ({formatPercent(total ? (data[s.key] / total) * 100 : 0, locale)})
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

/** Average progress of the most-enrolled trainings, as horizontal bars. */
export function TrainingProgressChart({ rows }: { rows: readonly TrainingProgressEntry[] }) {
  const t = useT();
  const { locale } = useLocale();
  return (
    <Stack component="ul" spacing={2} sx={{ p: 0, m: 0, listStyle: 'none' }} aria-label={t.dashboard.progressByTraining}>
      {rows.map((row) => (
        <Box component="li" key={row.trainingId}>
          <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {row.title}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              {formatPercent(row.averageProgress, locale)}
            </Typography>
          </Stack>
          <Box role="img" aria-label={`${row.title}: ${formatPercent(row.averageProgress, locale)}`} sx={{ height: 8, borderRadius: 0.5, bgcolor: 'grey.100', mt: 0.75, overflow: 'hidden' }} dir="ltr">
            <Box sx={{ height: '100%', width: `${Math.min(100, row.averageProgress)}%`, bgcolor: 'primary.main', borderRadius: 0.5 }} />
          </Box>
          <Typography variant="caption" color="text.secondary">
            {fill(t.dashboard.enrolledCompleted, { enrolled: formatNumber(row.enrollments, locale), completed: formatNumber(row.completed, locale) })}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
